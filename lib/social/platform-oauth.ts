import { createHash, randomBytes } from "crypto";
import { SocialPlatform } from "@prisma/client";
import { encryptSecret } from "@/lib/security/encryption";

type OAuthPlatform = "x" | "tiktok";

function getAppUrl() { return process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ""; }

export function isOAuthPlatform(platform: SocialPlatform): platform is OAuthPlatform {
  return platform === SocialPlatform.x || platform === SocialPlatform.tiktok;
}

export function isOAuthConfigured(platform: OAuthPlatform) {
  return platform === SocialPlatform.x
    ? Boolean(process.env.X_CLIENT_ID?.trim() && getAppUrl())
    : Boolean(process.env.TIKTOK_CLIENT_KEY?.trim() && process.env.TIKTOK_CLIENT_SECRET?.trim() && getAppUrl());
}

export function getOAuthRedirectUri(platform: OAuthPlatform) { return `${getAppUrl()}/api/social/${platform}/callback`; }

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function createOAuthState() { return randomBytes(24).toString("base64url"); }

export function buildPlatformOAuthUrl(platform: OAuthPlatform, accountId: string, state: string, challenge: string) {
  const url = new URL(platform === SocialPlatform.x ? "https://twitter.com/i/oauth2/authorize" : "https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_id", platform === SocialPlatform.x ? process.env.X_CLIENT_ID!.trim() : process.env.TIKTOK_CLIENT_KEY!.trim());
  url.searchParams.set("redirect_uri", getOAuthRedirectUri(platform));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", `${accountId}:${state}`);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", platform === SocialPlatform.x ? process.env.X_SCOPES?.trim() || "tweet.read users.read offline.access" : process.env.TIKTOK_SCOPES?.trim() || "user.info.basic");
  return url.toString();
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T & { error?: string; error_description?: string };
  if (!response.ok) throw new Error(payload.error_description ?? payload.error ?? "Social authorization failed.");
  return payload;
}

export async function exchangePlatformCode(platform: OAuthPlatform, code: string, verifier: string) {
  const body = new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: getOAuthRedirectUri(platform), code_verifier: verifier });
  if (platform === SocialPlatform.x) body.set("client_id", process.env.X_CLIENT_ID!.trim());
  else {
    body.set("client_key", process.env.TIKTOK_CLIENT_KEY!.trim());
    body.set("client_secret", process.env.TIKTOK_CLIENT_SECRET!.trim());
  }
  const response = await fetch(platform === SocialPlatform.x ? "https://api.x.com/2/oauth2/token" : "https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  return readJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string; open_id?: string }>(response);
}

export async function fetchPlatformProfile(platform: OAuthPlatform, accessToken: string) {
  const response = await fetch(platform === SocialPlatform.x ? "https://api.x.com/2/users/me?user.fields=username,name" : "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await readJson<{ data?: { id?: string; open_id?: string; username?: string; display_name?: string } }>(response);
  const profile = payload.data ?? {};
  return { externalAccountId: profile.id ?? profile.open_id ?? null, accountHandle: profile.username ? `@${profile.username}` : profile.display_name ?? null };
}

export function buildStoredPlatformAuth(input: { accessToken: string; refreshToken?: string; expiresIn?: number }) {
  return { encryptedAccessToken: encryptSecret(input.accessToken), encryptedRefreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : null, tokenExpiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null };
}
