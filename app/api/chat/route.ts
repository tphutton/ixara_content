import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getCurrentUserAccess();

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (access.approvalStatus !== ApprovalStatus.approved) {
    return NextResponse.json({ error: "Workspace access is not approved." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { message?: string; threadId?: string }
    | null;

  if (!body?.message?.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  try {
    getOpenAIClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Chat foundation is configured, but OPENAI_API_KEY is not set. Full assistant workflow arrives in Phase 4.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      threadId: body.threadId ?? null,
      message:
        "Chat orchestration is scaffolded but not implemented yet. Phase 4 will add thread persistence, tool calling, and database-backed actions.",
    },
    { status: 501 },
  );
}
