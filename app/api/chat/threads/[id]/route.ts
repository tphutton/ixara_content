import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";

async function getApprovedAccess() {
  const access = await getCurrentUserAccess();
  if (!access) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (access.approvalStatus !== ApprovalStatus.approved) {
    return { error: NextResponse.json({ error: "Workspace access is not approved." }, { status: 403 }) };
  }
  return { access };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getApprovedAccess();
  if (auth.error || !auth.access) return auth.error;
  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
  if (!title) return NextResponse.json({ error: "Conversation title is required." }, { status: 400 });

  const { id } = await context.params;
  const updated = await prisma.chatThread.updateMany({
    where: { id, userId: auth.access.id },
    data: { title },
  });
  if (updated.count !== 1) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ id, title });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getApprovedAccess();
  if (auth.error || !auth.access) return auth.error;
  const access = auth.access;

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
