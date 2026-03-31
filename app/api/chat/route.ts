import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { runContentOpsChat } from "@/lib/ai/chat-service";

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
    const result = await runContentOpsChat({
      access,
      message: body.message.trim(),
      threadId: body.threadId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The chat request failed.",
      },
      { status: 500 },
    );
  }
}
