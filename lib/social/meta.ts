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

  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Meta request failed.");
  }

  return payload;
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

export async function fetchMetaPages(accessToken: string) {
  const payload = await metaFetch<{ data?: MetaPageAccount[] }>(
    "/me/accounts",
    accessToken,
    {
      fields: "id,name,access_token,instagram_business_account{id,username}",
    },
  );

  return payload.data ?? [];
}

function scoreMetaPageMatch(account: ConnectedAccount, page: MetaPageAccount) {
  let score = 0;
  const accountName = account.accountName.toLowerCase();
  const accountHandle = account.accountHandle?.toLowerCase();

  if (page.name.toLowerCase() === accountName) {
    score += 4;
  }

  if (page.name.toLowerCase().includes(accountName) || accountName.includes(page.name.toLowerCase())) {
    score += 2;
  }

  if (accountHandle && page.instagram_business_account?.username?.toLowerCase() === accountHandle.replace(/^@/, "")) {
    score += 4;
  }

  return score;
}

export function chooseBestMetaPage(account: ConnectedAccount, pages: MetaPageAccount[]) {
  if (pages.length === 0) {
    return null;
  }

  const sorted = [...pages].sort((a, b) => scoreMetaPageMatch(account, b) - scoreMetaPageMatch(account, a));
  return sorted[0] ?? null;
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

export async function fetchFacebookPagePosts(pageId: string, pageAccessToken: string) {
  const payload = await metaFetch<{
    data?: Array<{
      id: string;
      message?: string;
      permalink_url?: string;
      created_time?: string;
      shares?: { count?: number };
      insights?: {
        data?: Array<{
          name: string;
          values?: Array<{ value?: number | Record<string, number> }>;
        }>;
      };
    }>;
  }>(`/${pageId}/published_posts`, pageAccessToken, {
    fields:
      "id,message,permalink_url,created_time,shares,insights.metric(post_impressions,post_impressions_unique,post_engaged_users)",
    limit: "25",
  });

  return payload.data ?? [];
}

export async function fetchInstagramMedia(igBusinessAccountId: string, accessToken: string) {
  const payload = await metaFetch<{
    data?: Array<{
      id: string;
      caption?: string;
      permalink?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
    }>;
  }>(`/${igBusinessAccountId}/media`, accessToken, {
    fields: "id,caption,permalink,timestamp,like_count,comments_count",
    limit: "25",
  });

  return payload.data ?? [];
}

export async function fetchInstagramMediaInsights(mediaId: string, accessToken: string) {
  try {
    const payload = await metaFetch<{
      data?: Array<{
        name: string;
        values?: Array<{ value?: number }>;
      }>;
    }>(`/${mediaId}/insights`, accessToken, {
      metric: "impressions,reach,engagement,saved",
    });

    return payload.data ?? [];
  } catch {
    return [];
  }
}
