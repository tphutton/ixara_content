import { NextResponse } from "next/server";
import { requireExternalApiKey } from "@/lib/external-api";
import { getContentCommandCenter } from "@/lib/planner/content-command-center";

export async function GET(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const data = await getContentCommandCenter();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load content planner";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
