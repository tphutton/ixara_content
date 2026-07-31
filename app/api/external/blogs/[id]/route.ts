import { NextResponse } from "next/server";
import { requireExternalApiKey } from "@/lib/external-api";
import { executeAtlasContentTool } from "@/lib/external/ops-execute";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const result = await executeAtlasContentTool("update_blog", { ...body, id });
    return NextResponse.json({ success: true, data: result.payload, summary: result.summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update blog";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
