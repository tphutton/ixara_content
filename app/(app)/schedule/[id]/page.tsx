import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialApprovalTargetType } from "@prisma/client";
import { EditorialApprovalPanel } from "@/components/approvals/editorial-approval-panel";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { ReadinessPanel } from "@/components/schedule/readiness-panel";
import { getScheduleReadiness } from "@/lib/schedule/readiness";
import { getMetaPublishReadiness } from "@/lib/social/meta-publish";
import {
  deleteScheduleAction,
  publishScheduleToMetaAction,
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
  const [schedule, contents, blogs, brandProfiles, connectedAccounts] = await Promise.all([
    prisma.contentSchedule.findUnique({
      where: { id },
      include: {
        content: {
          include: {
            primaryAsset: { select: { fileUrl: true, title: true } },
            selectedVariant: { select: { platform: true, hook: true, body: true, cta: true, status: true } },
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        blog: {
          include: {
            featureAsset: { select: { fileUrl: true, title: true } },
            qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        approvedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        publishedPosts: {
          select: {
            id: true,
            status: true,
            platform: true,
            externalPostUrl: true,
            deliveryAttempts: true,
            deliveryError: true,
            publishedAt: true,
          },
          orderBy: { publishedAt: "desc" },
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
    prisma.brandProfile.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
    prisma.connectedAccount.findMany({
      where: {
        platform: { in: ["facebook", "instagram"] },
      },
      orderBy: [{ status: "asc" }, { accountName: "asc" }],
    }),
  ]);

  if (!schedule) {
    notFound();
  }

  const updateAction = updateScheduleAction.bind(null, id);
  const deleteAction = deleteScheduleAction.bind(null, id);
  const publishAction = publishScheduleToMetaAction.bind(null, id);
  const readiness = getScheduleReadiness({
    channel: schedule.channel,
    platformAccount: schedule.platformAccount,
    brand: schedule.brand,
    approvedById: schedule.approvedById,
    content: schedule.content,
    blog: schedule.blog,
  });
  const metaReadiness = getMetaPublishReadiness(schedule, connectedAccounts);
  const selectedVariant = schedule.content?.selectedVariant ?? null;
  const packageSteps = [
    { label: "Context", ready: Boolean(schedule.content?.title ?? schedule.blog?.title) },
    { label: "Quality", ready: Boolean(schedule.content?.qualityReviews[0] && schedule.content.qualityReviews[0].overallScore >= 75) },
    { label: "Variant", ready: Boolean(selectedVariant && selectedVariant.status === "approved") },
    { label: "Asset", ready: Boolean(schedule.content?.primaryAsset?.fileUrl || schedule.content?.assetImage || schedule.blog?.featureAsset?.fileUrl) },
    { label: "Approval", ready: Boolean(schedule.approvedById) },
    { label: "Account", ready: Boolean(metaReadiness.account) },
  ];

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

          <section className="quiet-panel publishing-package-panel">
            <div className="section-heading">
              <div><p className="kicker">Publishing package</p><h3>Final version</h3></div>
              <StatusBadge label={metaReadiness.ready ? "ready" : "blocked"} />
            </div>
            <div className="metadata-grid">
              <div><span>Variant</span><strong>{schedule.content?.selectedVariant ? "Selected" : "Not selected"}</strong></div>
              <div><span>Platform</span><strong>{schedule.content?.selectedVariant?.platform ?? schedule.channel ?? "Not set"}</strong></div>
              <div><span>Asset</span><strong>{schedule.content?.primaryAsset?.title ?? schedule.content?.assetImage ?? "Not set"}</strong></div>
              <div><span>Campaign</span><strong>{schedule.campaignName ?? "Not set"}</strong></div>
              <div><span>Account</span><strong>{metaReadiness.account?.accountName ?? "Not matched"}</strong></div>
              <div><span>Approval</span><strong>{schedule.approvedById ? "Schedule approved" : "Awaiting approval"}</strong></div>
            </div>
            {schedule.content?.selectedVariant ? (
              <div className="publishing-package__copy">
                <p className="kicker">Selected copy</p>
                <p>{[schedule.content.selectedVariant.hook, schedule.content.selectedVariant.body, schedule.content.selectedVariant.cta].filter(Boolean).join("\n\n") || "No variant copy added"}</p>
                <span className="inline-chip">Variant status: {schedule.content.selectedVariant.status}</span>
              </div>
            ) : (
              <p className="quality-next-step">Select and approve a channel variant from the linked content record before publishing.</p>
            )}
            <div className="publishing-package__progress" aria-label="Publishing package progress">
              {packageSteps.map((step) => (
                <span data-ready={step.ready} key={step.label}>{step.label}</span>
              ))}
            </div>
          </section>

          <section className="quiet-panel channel-preview-panel">
            <div className="section-heading">
              <div><p className="kicker">Channel preview</p><h3>{selectedVariant?.platform ?? schedule.channel ?? "Unassigned channel"}</h3></div>
              <span className="inline-chip">Final copy</span>
            </div>
            <div className="channel-preview">
              {(schedule.content?.primaryAsset?.fileUrl || schedule.content?.assetImage || schedule.blog?.featureAsset?.fileUrl) ? (
                <img
                  alt={schedule.content?.primaryAsset?.title ?? schedule.blog?.featureAsset?.title ?? "Publishing asset"}
                  className="channel-preview__image"
                  src={schedule.content?.primaryAsset?.fileUrl ?? schedule.content?.assetImage ?? schedule.blog?.featureAsset?.fileUrl ?? ""}
                />
              ) : null}
              <div className="channel-preview__copy">
                <p className="kicker">{schedule.brand ?? schedule.content?.brand ?? schedule.blog?.brand ?? "Brand"}</p>
                <p>{selectedVariant ? [selectedVariant.hook, selectedVariant.body, selectedVariant.cta].filter(Boolean).join("\n\n") : schedule.content?.body ?? schedule.blog?.text1 ?? schedule.blog?.title ?? "No final copy selected yet."}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="stack">
          <ReadinessPanel readiness={readiness} />

          <section className="quiet-panel publish-readiness">
            <div className="section-heading">
              <div>
                <p className="kicker">Meta publishing</p>
                <h3>{metaReadiness.label}</h3>
              </div>
              <span className="inline-chip">{metaReadiness.platform ?? "No platform"}</span>
            </div>

            <div className="metadata-grid">
              <div><span>Account</span><strong>{metaReadiness.account?.accountName ?? "Not matched"}</strong></div>
              <div><span>State</span><strong>{metaReadiness.ready ? "Ready" : "Blocked"}</strong></div>
              <div><span>Published records</span><strong>{schedule.publishedPosts.length}</strong></div>
              <div><span>Approved</span><strong>{schedule.approvedById ? "Yes" : "No"}</strong></div>
            </div>

            {metaReadiness.reasons.length > 0 ? (
              <ul className="quality-list">
                {metaReadiness.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="quality-next-step">This entry can be published to the matched Meta account.</p>
            )}

            {schedule.publishedPosts.length > 0 ? (
              <div className="quiet-meta">
                {schedule.publishedPosts.slice(0, 3).map((post) => (
                  <span key={post.id}>
                    {post.externalPostUrl ? <Link href={post.externalPostUrl} target="_blank">{post.platform} · {post.status}</Link> : `${post.platform} · ${post.status}`}
                    {post.deliveryAttempts > 0 ? ` · ${post.deliveryAttempts} attempt${post.deliveryAttempts === 1 ? "" : "s"}` : ""}
                    {post.deliveryError ? ` · ${post.deliveryError}` : ""}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="form-actions">
              {metaReadiness.account ? (
                <Link className="button button--secondary" href={`/social-accounts?edit=${metaReadiness.account.id}`}>
                  Account
                </Link>
              ) : (
                <Link className="button button--secondary" href="/social-accounts?add=1">
                  Connect account
                </Link>
              )}
              {metaReadiness.ready ? (
                <form action={publishAction}>
                  <SubmitButton label="Publish to Meta" pendingLabel="Publishing..." />
                </form>
              ) : (
                <button className="button button--secondary" disabled type="button">
                  Publish to Meta
                </button>
              )}
            </div>
          </section>

          <EditorialApprovalPanel path={`/schedule/${id}`} targetId={schedule.id} targetType={EditorialApprovalTargetType.schedule} />
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
              <ScheduleForm action={updateAction} blogs={blogs} brandProfiles={brandProfiles} contents={contents} schedule={schedule} />
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
