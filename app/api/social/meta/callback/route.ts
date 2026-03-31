import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ConnectedAccountStatus, SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildStoredMetaAuth,
  chooseBestMetaPage,
  exchangeMetaCodeForToken,
  fetchMetaPages,
  isMetaConfigured,
} from "@/lib/social/meta";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");

  if (!isMetaConfigured()) {
    return NextResponse.redirect(new URL("/social-accounts?error=meta_not_configured", request.url));
  }

  if (errorReason || errorDescription) {
    return NextResponse.redirect(
      new URL(`/social-accounts?error=${encodeURIComponent(errorDescription ?? errorReason ?? "meta_authorization_failed")}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/social-accounts?error=missing_meta_callback_state", request.url));
  }

  const [accountId, nonce] = state.split(":");

  if (!accountId || !nonce) {
    return NextResponse.redirect(new URL("/social-accounts?error=invalid_meta_state", request.url));
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get(`meta_oauth_state_${accountId}`)?.value;
  cookieStore.delete(`meta_oauth_state_${accountId}`);

  if (!storedNonce || storedNonce !== nonce) {
    return NextResponse.redirect(new URL("/social-accounts?error=meta_state_mismatch", request.url));
  }

  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return NextResponse.redirect(new URL("/social-accounts?error=account_not_found", request.url));
  }

  try {
    const tokenPayload = await exchangeMetaCodeForToken(code);
    const pages = await fetchMetaPages(tokenPayload.access_token!);
    const selectedPage = chooseBestMetaPage(account, pages);

    if (!selectedPage) {
      throw new Error("No eligible Meta pages were returned for this account.");
    }

    const tokenValue = selectedPage.access_token ?? tokenPayload.access_token!;
    const storedAuth = buildStoredMetaAuth(tokenValue, tokenPayload.expires_in);
    const isInstagram = account.platform === SocialPlatform.instagram;
    const instagramBusinessAccountId = selectedPage.instagram_business_account?.id ?? null;

    if (isInstagram && !instagramBusinessAccountId) {
      throw new Error("No Instagram business account was found on the connected Meta page.");
    }

    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        status: ConnectedAccountStatus.active,
        externalAccountId: isInstagram ? instagramBusinessAccountId : selectedPage.id,
        accountHandle:
          account.accountHandle ??
          selectedPage.instagram_business_account?.username ??
          null,
        scopes: process.env.META_SCOPES?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
        encryptedAccessToken: storedAuth.encryptedAccessToken,
        tokenExpiresAt: storedAuth.tokenExpiresAt,
        lastSyncStatus: `Meta connected to ${selectedPage.name}`,
        metadata: {
          metaPageId: selectedPage.id,
          metaPageName: selectedPage.name,
          instagramBusinessAccountId,
          instagramUsername: selectedPage.instagram_business_account?.username ?? null,
        },
      },
    });

    return NextResponse.redirect(new URL("/social-accounts?success=meta_connected", request.url));
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
        request.url,
      ),
    );
  }
}
