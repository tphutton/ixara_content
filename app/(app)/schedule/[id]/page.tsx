import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { prisma } from "@/lib/prisma";
import { ReadinessPanel } from "@/components/schedule/readiness-panel";
import { getScheduleReadiness } from "@/lib/schedule/readiness";
import {
  approveScheduleAction,
  clearScheduleApprovalAction,
  deleteScheduleAction,
  updateScheduleAction,
} from "../actions";

export const dynamic = "force-dynamic";

type ScheduleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScheduleDetailPage({ params }: ScheduleDetailPageProps) {
  const { id } = await params;
  const [schedule, contents, blogs] = await Promise.all([
    prisma.contentSchedule.findUnique({
      where: { id },
      include: {
        content: {
          select: {
            title: true,
            brand: true,
            tone: true,
            targetAudience: true,
            primaryAssetId: true,
            assetImage: true,
          },
        },
        blog: {
          select: {
            title: true,
            brand: true,
            websites: true,
            featureAssetId: true,
            featureImage: true,
          },
        },
        approvedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
    prisma.content.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.blog.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  if (!schedule) {
    notFound();
  }

  const updateAction = updateScheduleAction.bind(null, id);
  const deleteAction = deleteScheduleAction.bind(null, id);
  const approveAction = approveScheduleAction.bind(null, id);
  const clearApprovalAction = clearScheduleApprovalAction.bind(null, id);
  const readiness = getScheduleReadiness({
    channel: schedule.channel,
    platformAccount: schedule.platformAccount,
    brand: schedule.brand,
    approvedById: schedule.approvedById,
    content: schedule.content,
    blog: schedule.blog,
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Schedule Entry"
        description="Update scheduling metadata, linked records, publishing status, and operational notes."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start" }}>
        <div className="stack">
          <Link className="button button--secondary" href="/schedule">
            Back to schedule
          </Link>
          <div className="card card--padded">
            <ScheduleForm action={updateAction} blogs={blogs} contents={contents} schedule={schedule} />
          </div>
          <form action={deleteAction}>
            <SubmitButton label="Delete schedule entry" pendingLabel="Deleting..." variant="secondary" />
          </form>
        </div>

        <div className="stack">
          <ReadinessPanel readiness={readiness} />

          <article className="card card--padded">
            <p className="kicker">Approval</p>
            <h3 style={{ marginTop: 0 }}>
              {schedule.approvedBy
                ? `Approved by ${schedule.approvedBy.fullName ?? schedule.approvedBy.email}`
                : "Not approved yet"}
            </h3>
            <p className="muted">
              Use approval to mark which schedule entries are safe for later automation and
              publishing queues.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {schedule.approvedById ? (
                <form action={clearApprovalAction}>
                  <SubmitButton
                    label="Clear approval"
                    pendingLabel="Clearing approval..."
                    variant="secondary"
                  />
                </form>
              ) : (
                <form action={approveAction}>
                  <SubmitButton
                    label="Approve for queue"
                    pendingLabel="Approving..."
                  />
                </form>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
