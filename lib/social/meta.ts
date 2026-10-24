import { SocialPlatform, type ConnectedAccount } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

const META_GRAPH_BASE = "https://graph.facebook.com/v23.0";
const META_OAUTH_BASE = "https://www.facebook.com/v23.0/dialog/oauth";
const DEFAULT_META_REAUTH_BUFFER_DAYS = 3;

export type MetaPageAccount = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
};

export class MetaReauthRequiredError extends Error {
  constructor(message = "Meta account needs reauthorization.") {
    super(message);
    this.name = "MetaReauthRequiredError";
  }
}

export class MetaApiError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
  }
}

export function isUnavailableInsight(error: unknown) {
  return error instanceof MetaApiError && (
    [10, 200].includes(error.code ?? 0) ||
    (error.code === 100 && /metric|insight|not supported|not available|older than|before.*business/i.test(error.message))
  );
}

function getMetaConfig() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const scopes =
    process.env.META_SCOPES?.trim() ||
    "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_manage_insights,instagram_content_publish";

  return {
    appId,
    appSecret,
    appUrl,
    scopes,
    redirectUri: appUrl ? `${appUrl}/api/social/meta/callback` : null,
  };
}

export function isMetaConfigured() {
  const { appId, appSecret, redirectUri } = getMetaConfig();
  return Boolean(appId && appSecret && redirectUri);
}

export function isMetaPlatform(platform: SocialPlatform) {
  return platform === SocialPlatform.facebook || platform === SocialPlatform.instagram;
}

export function buildMetaOAuthUrl(accountId: string, state: string) {
  const { appId, redirectUri, scopes } = getMetaConfig();

  if (!appId || !redirectUri) {
    throw new Error("Meta OAuth is not configured.");
  }

  const url = new URL(META_OAUTH_BASE);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", `${accountId}:${state}`);

  return url.toString();
}

async function metaFetch<T>(path: string, accessToken: string, query?: Record<string, string>) {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json()) as T & { error?: { message?: string; code?: number } };

  if (!response.ok) {
    if (payload.error?.code === 190) throw new MetaReauthRequiredError("Meta token expired or was revoked. Reconnect the account.");
    throw new MetaApiError(payload.error?.message ?? "Meta request failed.", payload.error?.code);
  }

  return payload;
}

export async function fetchMetaMediaContainerStatus(containerId: string, accessToken: string) {
  return metaFetch<{ status_code?: string; status?: string }>(
    `/${containerId}`,
    accessToken,
    { fields: "status_code,status" },
  );
}

export async function metaPost<T>(path: string, accessToken: string, body: Record<string, string>) {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    body: new URLSearchParams(body),
  });

  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Meta publish request failed.");
  }

  return payload;
}

export async function fetchMetaPostPermalink(
  postId: string,
  platform: SocialPlatform,
  accessToken: string,
) {
  const field = platform === SocialPlatform.instagram ? "permalink" : "permalink_url";
  const payload = await metaFetch<{ permalink?: string; permalink_url?: string }>(
    `/${postId}`,
    accessToken,
    { fields: field },
  );

  return payload.permalink ?? payload.permalink_url ?? null;
}

export async function exchangeMetaCodeForToken(code: string) {
  const { appId, appSecret, redirectUri } = getMetaConfig();

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Meta OAuth is not configured.");
  }

  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message ?? "Meta token exchange failed.");
  }

  return payload;
}

export async function exchangeForLongLivedMetaToken(shortLivedToken: string) {
  const { appId, appSecret } = getMetaConfig();

  if (!appId || !appSecret) {
    throw new Error("Meta OAuth is not configured.");
  }

  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const payload = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message ?? "Meta long-lived token exchange failed.");
  }

  return payload;
}

export async function fetchMetaPages(accessToken: string) {
  return fetchMetaCollection<MetaPageAccount>("/me/accounts", accessToken, {
    fields: "id,name,access_token,instagram_business_account{id,username}", limit: "25",
  });
}

export function getStoredMetaToken(account: ConnectedAccount) {
  if (!account.encryptedAccessToken) {
    return null;
  }

  return decryptSecret(account.encryptedAccessToken);
}

export function assertMetaAccountReadyForSync(account: ConnectedAccount) {
  if (!account.encryptedAccessToken) {
    throw new MetaReauthRequiredError("Meta account is missing an access token. Reconnect the account.");
  }

  if (!account.tokenExpiresAt) {
    return;
  }

  const bufferDays = Number(process.env.META_REAUTH_BUFFER_DAYS ?? DEFAULT_META_REAUTH_BUFFER_DAYS);
  const safeBufferDays = Number.isFinite(bufferDays) ? Math.max(bufferDays, 0) : DEFAULT_META_REAUTH_BUFFER_DAYS;
  const reauthAt = account.tokenExpiresAt.getTime() - safeBufferDays * 24 * 60 * 60 * 1000;

  if (Date.now() >= reauthAt) {
    throw new MetaReauthRequiredError("Meta access token is expired or near expiry. Reconnect the account.");
  }
}

export function getMetaTokenExpiry(expiresInSeconds?: number) {
  if (!expiresInSeconds) {
    return null;
  }

  return new Date(Date.now() + expiresInSeconds * 1000);
}

export function buildStoredMetaAuth(accessToken: string, expiresInSeconds?: number) {
  return {
    encryptedAccessToken: encryptSecret(accessToken),
    tokenExpiresAt: getMetaTokenExpiry(expiresInSeconds),
  };
}

type MetaCollection<T> = {
  data?: T[];
  paging?: { next?: string; cursors?: { after?: string } };
};

async function fetchMetaCollection<T extends { id: string }>(
  path: string, accessToken: string, query: Record<string, string>,
) {
  const items = new Map<string, T>();
  const cursors = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const payload = await metaFetch<MetaCollection<T>>(path, accessToken, {
      ...query, ...(after ? { after } : {}),
    });
    for (const item of payload.data ?? []) items.set(item.id, item);
    // A short or empty page may still have another page. Never follow provider URLs.
    const next = payload.paging?.next ? payload.paging.cursors?.after : undefined;
    if (!payload.paging?.next) return [...items.values()];
    if (!next || cursors.has(next)) throw new Error("Meta returned invalid pagination. Retry sync.");
    cursors.add(next);
    after = next;
  }
  throw new Error("Meta history exceeds the sync page limit. A batched backfill is required.");
}

export async function fetchFacebookPagePosts(pageId: string, pageAccessToken: string) {
  return fetchMetaCollection<{
    id: string; message?: string; permalink_url?: string; created_time?: string;
    shares?: { count?: number };
  }>(`/${pageId}/published_posts`, pageAccessToken, {
    fields: "id,message,permalink_url,created_time,shares", limit: "25",
  });
}

export type MetaInsight = {
  name: string;
  values?: Array<{ value?: number }>;
  total_value?: { value?: number };
};

// Fetch together normally; isolate only unsupported metrics so one unavailable
// metric never discards supported data. Auth/rate-limit/network errors propagate.
async function fetchOptionalInsights(id: string, token: string, metrics: string[]) {
  const request = async (names: string[]) => {
    const result = await metaFetch<{ data?: MetaInsight[] }>(`/${id}/insights`, token, {
      metric: names.join(","),
    });
    return result.data ?? [];
  };
  try {
    const data = await request(metrics);
    return { data, unavailable: metrics.filter((name) => !data.some((item) => item.name === name)) };
  } catch (error) {
    if (!isUnavailableInsight(error)) throw error;
    if (error instanceof MetaApiError && [10, 200].includes(error.code ?? 0)) {
      return { data: [], unavailable: metrics };
    }
    const data: MetaInsight[] = [];
    const unavailable: string[] = [];
    for (const metric of metrics) {
      try {
        const values = await request([metric]);
        data.push(...values);
        if (!values.some((item) => item.name === metric)) unavailable.push(metric);
      }
      catch (singleError) {
        if (!isUnavailableInsight(singleError)) throw singleError;
        unavailable.push(metric);
      }
    }
    return { data, unavailable };
  }
}

export function fetchFacebookPostInsights(postId: string, token: string) {
  return fetchOptionalInsights(postId, token, ["post_media_view", "post_clicks"]);
}

export async function fetchInstagramMedia(igBusinessAccountId: string, accessToken: string) {
  return fetchMetaCollection<{
    id: string; caption?: string; permalink?: string; timestamp?: string;
    like_count?: number; comments_count?: number;
  }>(`/${igBusinessAccountId}/media`, accessToken, {
    fields: "id,caption,permalink,timestamp,like_count,comments_count", limit: "25",
  });
}

export function fetchInstagramMediaInsights(mediaId: string, accessToken: string) {
  return fetchOptionalInsights(mediaId, accessToken, ["views", "reach", "total_interactions", "saved", "shares"]);
}
