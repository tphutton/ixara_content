import { NextResponse } from "next/server";
import { requireExternalApiKey } from "@/lib/external-api";
import { executeAtlasContentTool } from "@/lib/external/ops-execute";

export async function GET(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const args: Record<string, unknown> = {};
    for (const key of ["status", "brand", "channel"] as const) {
      const value = searchParams.get(key);
      if (value) args[key] = value;
    }
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from) args.from = from;
    if (to) args.to = to;
    const limit = searchParams.get("limit");
    if (limit) args.limit = Number(limit);

    const result = await executeAtlasContentTool("list_schedule_entries", args);
    return NextResponse.json({ success: true, data: result.payload, summary: result.summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list schedule entries";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await executeAtlasContentTool("create_schedule_entry", body);
    return NextResponse.json({ success: true, data: result.payload, summary: result.summary }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create schedule entry";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
