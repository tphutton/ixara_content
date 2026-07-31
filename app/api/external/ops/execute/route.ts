import { NextResponse } from "next/server";
import { requireExternalApiKey } from "@/lib/external-api";
import { ATLAS_ALLOWED_TOOLS, executeAtlasContentTool } from "@/lib/external/ops-execute";

/**
 * Atlas / MCP entrypoint into Content Ops.
 * Executes Quill-equivalent tools under the Atlas system actor.
 */
export async function POST(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as {
      tool?: string;
      args?: Record<string, unknown>;
      payload?: Record<string, unknown>;
    };

    const tool = typeof body.tool === "string" ? body.tool.trim() : "";
    if (!tool) {
      return NextResponse.json(
        { success: false, error: "tool is required", allowed_tools: [...ATLAS_ALLOWED_TOOLS] },
        { status: 400 },
      );
    }

    const args = (body.args && typeof body.args === "object" ? body.args : null)
      || (body.payload && typeof body.payload === "object" ? body.payload : null)
      || {};

    const result = await executeAtlasContentTool(tool, args);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed";
    const status = message.includes("not available") ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET(request: Request) {
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  return NextResponse.json({
    success: true,
    data: {
      service: "content.ixara.tech",
      operator: "atlas",
      allowed_tools: [...ATLAS_ALLOWED_TOOLS].sort(),
    },
  });
}
