import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUserAccess } from "@/lib/auth/user-access";
import { executeQuillActionProposal, rejectQuillActionProposal } from "@/lib/ai/action-proposals";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.approvalStatus !== ApprovalStatus.approved) {
    return NextResponse.json({ error: "Workspace access is not approved." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { decision?: string } | null;
  if (body?.decision !== "approve" && body?.decision !== "reject") {
    return NextResponse.json({ error: "Decision must be approve or reject." }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    const proposal = body.decision === "reject"
      ? await rejectQuillActionProposal(id, access)
      : await executeQuillActionProposal(id, access);
    return NextResponse.json({ proposal });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quill action failed." },
      { status: 400 },
    );
  }
}
