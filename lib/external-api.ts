import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function readProvidedKey(request: Request) {
  const headerKey = request.headers.get("x-ixara-api-key");
  const authHeader = request.headers.get("authorization");

  if (headerKey?.trim()) {
    return headerKey.trim();
  }

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

function keysMatch(providedKey: string, expectedKey: string) {
  const provided = Buffer.from(providedKey);
  const expected = Buffer.from(expectedKey);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function requireExternalApiKey(request: Request) {
  const expectedKey = process.env.IXARA_EXTERNAL_API_KEY;

  if (!expectedKey) {
    return NextResponse.json(
      {
        error: "External API is not configured. Set IXARA_EXTERNAL_API_KEY in the environment.",
      },
      { status: 503 },
    );
  }

  const providedKey = readProvidedKey(request);

  if (!providedKey || !keysMatch(providedKey, expectedKey)) {
    return NextResponse.json(
      {
        error: "Invalid or missing API key.",
      },
      { status: 401 },
    );
  }

  return null;
}
