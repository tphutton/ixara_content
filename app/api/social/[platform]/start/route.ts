import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SocialPlatform } from "@prisma/client";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";
import { buildPlatformOAuthUrl, createOAuthState, createPkcePair, isOAuthConfigured, isOAuthPlatform } from "@/lib/social/platform-oauth";

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access || access.approvalStatus !== "approved" || access.role === "viewer") return NextResponse.redirect(new URL("/sign-in", request.url));
  const { platform: rawPlatform } = await params;
  const platform = rawPlatform as SocialPlatform;
  const accountId = new URL(request.url).searchParams.get("accountId");
  if (!accountId || !isOAuthPlatform(platform) || !isOAuthConfigured(platform)) return NextResponse.redirect(new URL(`/social-accounts?error=${platform}_not_configured`, request.url));
  const account = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== platform) return NextResponse.redirect(new URL("/social-accounts?error=invalid_account", request.url));
  const state = createOAuthState();
  const { verifier, challenge } = createPkcePair();
  const cookieStore = await cookies();
  const options = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  cookieStore.set(`${platform}_oauth_state_${accountId}`, state, options);
  cookieStore.set(`${platform}_oauth_verifier_${accountId}`, verifier, options);
  return NextResponse.redirect(buildPlatformOAuthUrl(platform, accountId, state, challenge));
}
