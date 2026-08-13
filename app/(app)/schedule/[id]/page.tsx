import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { prisma } from "@/lib/prisma";
import { ReadinessPanel } from "@/components/schedule/readiness-panel";
import { getScheduleReadiness } from "@/lib/schedule/readiness";
import { getQualityGate } from "@/lib/quality/gates";
import {
  approveScheduleAction,
  clearScheduleApprovalAction,
  deleteScheduleAction,
  updateScheduleAction,
} from "../actions";

export const dynamic = "force-dynamic";

type ScheduleDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string }>;
};

export default async function ScheduleDetailPage({ params, searchParams }: ScheduleDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isEditing = resolvedSearchParams?.edit === "1";
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
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        blog: {
          select: {
            title: true,
            brand: true,
            websites: true,
            featureAssetId: true,
            featureImage: true,
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
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
  const latestQualityReview =
    schedule.content?.qualityReviews[0] ?? schedule.blog?.qualityReviews[0] ?? null;
  const qualityGate = getQualityGate(latestQualityReview);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Schedule Entry"
        description="Review schedule readiness and approval state before opening the editor."
        actions={
          <div className="header-actions">
            <Link className="button button--secondary" href="/schedule">
              Back
            </Link>
            <Link className="button button--primary" href={`/schedule/${id}?edit=1`}>
              Edit schedule
            </Link>
          </div>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start" }}>
        <div className="stack">
          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Scheduled work</p>
                <h3>{schedule.content?.title ?? schedule.blog?.title ?? "Untitled scheduled item"}</h3>
              </div>
              <span className="inline-chip">{schedule.status}</span>
            </div>
            <div className="metadata-grid">
              <div><span>Scheduled for</span><strong>{new Date(schedule.scheduledFor).toLocaleString()}</strong></div>
              <div><span>Channel</span><strong>{schedule.channel ?? "Not set"}</strong></div>
              <div><span>Account</span><strong>{schedule.platformAccount ?? "Not set"}</strong></div>
              <div><span>Brand</span><strong>{schedule.brand ?? "Not set"}</strong></div>
              <div><span>Campaign</span><strong>{schedule.campaignName ?? "Not set"}</strong></div>
              <div><span>Priority</span><strong>{schedule.priority ?? "Not set"}</strong></div>
            </div>
            {schedule.notes ? <p className="muted">{schedule.notes}</p> : null}
          </section>
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
            <div className="quality-approval-warning" data-ready={qualityGate.ready}>
              <strong>{qualityGate.ready ? "Quality gate passed" : "Quality gate warning"}</strong>
              <p className="muted">
                {qualityGate.ready
                  ? qualityGate.label
                  : qualityGate.reasons.join(" ")}
              </p>
              {latestQualityReview ? (
                <Link
                  className="button button--secondary"
                  href={
                    schedule.contentId
                      ? `/content/${schedule.contentId}`
                      : schedule.blogId
                        ? `/blogs/${schedule.blogId}`
                        : "/schedule"
                  }
                >
                  Open quality review
                </Link>
              ) : null}
            </div>

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
                  {!qualityGate.ready ? (
                    <input name="qualityOverride" type="hidden" value="true" />
                  ) : null}
                  <SubmitButton
                    label={qualityGate.ready ? "Approve for queue" : "Approve with warning"}
                    pendingLabel="Approving..."
                  />
                </form>
              )}
            </div>
          </article>
        </div>
      </div>

      {isEditing ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close editor" href={`/schedule/${id}`} />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Editing</p>
                <h3>Schedule entry</h3>
                <p className="muted">Update timing, links, metadata, and operational notes.</p>
              </div>
              <Link className="button button--secondary" href={`/schedule/${id}`}>
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <ScheduleForm action={updateAction} blogs={blogs} contents={contents} schedule={schedule} />
            </div>
            <div className="editor-overlay__footer">
              <form action={deleteAction}>
                <SubmitButton label="Delete schedule entry" pendingLabel="Deleting..." variant="secondary" />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
