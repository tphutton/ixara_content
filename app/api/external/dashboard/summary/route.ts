import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/dashboard/summary";
import { requireExternalApiKey } from "@/lib/external-api";

export async function GET(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const data = await getDashboardSummary();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load content dashboard";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
