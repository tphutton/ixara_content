import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ConnectedAccountStatus, Prisma } from "@prisma/client";
import { requireEditorialUserAccess } from "@/lib/auth/user-access";
import { createMetaSelection, eligibleMetaPages } from "@/lib/social/meta-selection";
import { prisma } from "@/lib/prisma";
import {
    exchangeMetaCodeForToken,
    exchangeForLongLivedMetaToken,
  fetchMetaPages,
  isMetaConfigured,
} from "@/lib/social/meta";

export async function GET(request: Request) {
  const access = await requireEditorialUserAccess();
  // Railway may expose localhost in request.url; redirect to the configured public origin.
  const redirectBase = new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");

  if (!isMetaConfigured()) {
    return NextResponse.redirect(new URL("/social-accounts?error=meta_not_configured", redirectBase));
  }

  if (errorReason || errorDescription) {
    return NextResponse.redirect(
      new URL(`/social-accounts?error=${encodeURIComponent(errorDescription ?? errorReason ?? "meta_authorization_failed")}`, redirectBase),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/social-accounts?error=missing_meta_callback_state", redirectBase));
  }

  const [accountId, nonce] = state.split(":");

  if (!accountId || !nonce) {
    return NextResponse.redirect(new URL("/social-accounts?error=invalid_meta_state", redirectBase));
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get(`meta_oauth_state_${accountId}`)?.value;
  cookieStore.delete(`meta_oauth_state_${accountId}`);

  if (!storedNonce || storedNonce !== nonce) {
    return NextResponse.redirect(new URL("/social-accounts?error=meta_state_mismatch", redirectBase));
  }

  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return NextResponse.redirect(new URL("/social-accounts?error=account_not_found", redirectBase));
  }

  try {
    const shortLivedToken = await exchangeMetaCodeForToken(code);
    const tokenPayload = await exchangeForLongLivedMetaToken(shortLivedToken.access_token!);
    const pages = await fetchMetaPages(tokenPayload.access_token!);
    const candidates = eligibleMetaPages(account.platform, pages);
    if (!candidates.length) throw new Error("No eligible accounts were returned. Grant access to the intended Facebook Page and its linked Instagram account, then reconnect.");
    const metadata = account.metadata && typeof account.metadata === "object" && !Array.isArray(account.metadata)
      ? account.metadata as Record<string, Prisma.JsonValue> : {};
    const encryptedSelection = createMetaSelection({
      accountId: account.id, ownerId: access.id, pages: candidates,
      tokenExpiresAt: tokenPayload.expires_in ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString() : null,
    });
    // Keep existing credentials intact until the user explicitly selects an identity.
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: { metadata: { ...metadata, pendingMetaConnection: encryptedSelection } },
    });
    return NextResponse.redirect(new URL("/social-accounts/select-meta?accountId=" + encodeURIComponent(account.id), redirectBase));
  } catch (error) {
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        status: ConnectedAccountStatus.error,
        lastSyncStatus: error instanceof Error ? error.message : "Meta connection failed.",
      },
    });

    return NextResponse.redirect(
      new URL(
        `/social-accounts?error=${encodeURIComponent(error instanceof Error ? error.message : "Meta connection failed.")}`,
        redirectBase,
      ),
    );
  }
}
