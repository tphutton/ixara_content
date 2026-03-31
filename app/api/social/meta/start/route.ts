import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";
import { buildMetaOAuthUrl, isMetaConfigured, isMetaPlatform } from "@/lib/social/meta";

export async function GET(request: Request) {
  const access = await getCurrentUserAccess();

  if (!access || access.approvalStatus !== "approved" || access.role === "viewer") {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (!isMetaConfigured()) {
    return NextResponse.redirect(new URL("/social-accounts?error=meta_not_configured", request.url));
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.redirect(new URL("/social-accounts?error=missing_account", request.url));
  }

  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || !isMetaPlatform(account.platform)) {
    return NextResponse.redirect(new URL("/social-accounts?error=invalid_account", request.url));
  }

  const nonce = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(`meta_oauth_state_${accountId}`, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildMetaOAuthUrl(accountId, nonce));
}
