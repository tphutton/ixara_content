import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.approvalStatus !== ApprovalStatus.approved) {
    return NextResponse.json({ error: "Workspace access is not approved." }, { status: 403 });
  }

  const { id } = await context.params;
  const executingAction = await prisma.quillActionProposal.findFirst({
    where: { threadId: id, userId: access.id, status: "executing" },
    select: { id: true },
  });
  if (executingAction) {
    return NextResponse.json(
      { error: "This conversation has an action currently executing. Try again when it finishes." },
      { status: 409 },
    );
  }
  const deleted = await prisma.chatThread.deleteMany({ where: { id, userId: access.id } });
  if (deleted.count !== 1) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
