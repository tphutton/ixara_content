import { NextResponse } from "next/server";
import { requireExternalApiKey } from "@/lib/external-api";

export async function GET(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  return NextResponse.json({
    ok: true,
    service: "Ixara Content External API",
    baseUrl: "https://content.ixara.tech",
    version: "2026-07-27",
  });
}
