import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ConnectedAccountStatus, SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildStoredPlatformAuth, exchangePlatformCode, fetchPlatformProfile, isOAuthConfigured, isOAuthPlatform } from "@/lib/social/platform-oauth";

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: rawPlatform } = await params;
  const platform = rawPlatform as SocialPlatform;
  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error_description") ?? searchParams.get("error");
  if (!isOAuthPlatform(platform) || !isOAuthConfigured(platform)) return NextResponse.redirect(new URL(`/social-accounts?error=${platform}_not_configured`, request.url));
  if (error) return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(error)}`, request.url));
  if (!code || !state) return NextResponse.redirect(new URL(`/social-accounts?error=missing_${platform}_callback_state`, request.url));
  const [accountId, nonce] = state.split(":");
  const cookieStore = await cookies();
  const stateKey = `${platform}_oauth_state_${accountId}`;
  const verifierKey = `${platform}_oauth_verifier_${accountId}`;
  const storedState = cookieStore.get(stateKey)?.value;
  const verifier = cookieStore.get(verifierKey)?.value;
  cookieStore.delete(stateKey);
  cookieStore.delete(verifierKey);
  if (!storedState || storedState !== nonce || !verifier) return NextResponse.redirect(new URL(`/social-accounts?error=${platform}_state_mismatch`, request.url));
  const account = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== platform) return NextResponse.redirect(new URL("/social-accounts?error=account_not_found", request.url));
  try {
    const token = await exchangePlatformCode(platform, code, verifier);
    const profile = await fetchPlatformProfile(platform, token.access_token);
    const storedAuth = buildStoredPlatformAuth({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in });
    await prisma.connectedAccount.update({ where: { id: account.id }, data: { status: ConnectedAccountStatus.active, ...profile, scopes: token.scope?.split(" ").filter(Boolean) ?? [], ...storedAuth, lastSyncStatus: `${platform} authorized. Live post sync and publishing are not enabled yet.` } });
    return NextResponse.redirect(new URL(`/social-accounts?success=${platform}_connected`, request.url));
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : `${platform} authorization failed.`;
    await prisma.connectedAccount.update({ where: { id: account.id }, data: { status: ConnectedAccountStatus.error, lastSyncStatus: message } });
    return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(message)}`, request.url));
  }
}
