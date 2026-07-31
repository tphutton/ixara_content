import { NextResponse } from "next/server";
import { requireExternalApiKey } from "@/lib/external-api";
import { executeAtlasContentTool } from "@/lib/external/ops-execute";

export async function GET(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const args: Record<string, unknown> = {};
    for (const key of ["status", "brand", "category"] as const) {
      const value = searchParams.get(key);
      if (value) args[key] = value;
    }
    const limit = searchParams.get("limit");
    if (limit) args.limit = Number(limit);

    const result = await executeAtlasContentTool("list_blogs", args);
    return NextResponse.json({ success: true, data: result.payload, summary: result.summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list blogs";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await executeAtlasContentTool("create_blog", {
      ...body,
      status: body.status || "draft",
      sourcePrompt: body.sourcePrompt || body.brief || body.note || null,
    });
    return NextResponse.json({ success: true, data: result.payload, summary: result.summary }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create blog";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
