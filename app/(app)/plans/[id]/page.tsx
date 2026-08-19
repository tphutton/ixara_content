import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { PlanForm } from "@/components/plans/plan-form";
import { PlanItemForm } from "@/components/plans/plan-item-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { reviewPlanItemQualityAction } from "../../quality/actions";
import {
  addContentPlanItemAction,
  deleteContentPlanAction,
  deleteContentPlanItemAction,
  promoteContentPlanItemAction,
  updateContentPlanAction,
  updateContentPlanItemStatusAction,
} from "../actions";

type PlanDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ add?: string; edit?: string }>;
};

function formatDate(date: Date | null) {
  return date ? format(date, "MMM d, yyyy") : "Not set";
}

function formatScheduled(date: Date | null) {
  return date ? format(date, "MMM d, p") : "Unscheduled";
}

export default async function PlanDetailPage({ params, searchParams }: PlanDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isAddingItem = resolvedSearchParams?.add === "1";
  const isEditingPlan = resolvedSearchParams?.edit === "1";
  const plan = await prisma.contentPlan.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          content: { select: { id: true, title: true } },
          blog: { select: { id: true, title: true } },
          schedule: { select: { id: true, scheduledFor: true } },
          qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!plan) {
    notFound();
  }

  const updatePlan = updateContentPlanAction.bind(null, plan.id);
  const deletePlan = deleteContentPlanAction.bind(null, plan.id);
  const addItem = addContentPlanItemAction.bind(null, plan.id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={plan.title}
        description={plan.goal ?? plan.description ?? "Plan the creative work, then turn approved items into records and schedule entries."}
        actions={
          <div className="header-actions">
            <Link className="button button--secondary" href="/plans">
              All plans
            </Link>
            <Link className="button button--secondary" href={`/plans/${plan.id}?edit=1`}>
              Edit plan
            </Link>
            <form action={deletePlan}>
              <button className="button button--secondary" type="submit">
                Delete plan
              </button>
            </form>
            <Link className="button button--primary" href={`/plans/${plan.id}?add=1`}>
              Add item
            </Link>
            <Link className="button button--primary" href={`/chat?prompt=${encodeURIComponent(`Review this content plan and suggest the next best items to create. Plan id: ${plan.id}`)}`}>
              Ask Quill
            </Link>
          </div>
        }
      />

      <div className="stack">
          <section className="quiet-panel">
            <div className="plan-brief">
              <div>
                <p className="kicker">Plan brief</p>
                <h3>{plan.goal ?? "No goal yet"}</h3>
                <p className="muted">{plan.description ?? "Add the audience, offer, publishing rhythm, and decision criteria for this plan."}</p>
              </div>
              <StatusBadge label={plan.status} />
            </div>

            <div className="quiet-meta quiet-meta--large">
              <span>{plan.brand ?? "No brand"}</span>
              <span>{plan.campaignName ?? "No campaign"}</span>
              <span>{formatDate(plan.startDate)} to {formatDate(plan.endDate)}</span>
            </div>
          </section>

          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Work items</p>
                <h3>{plan.items.length} planned unit{plan.items.length === 1 ? "" : "s"}</h3>
              </div>
            </div>

            {plan.items.length === 0 ? (
              <div className="empty-state empty-state--quiet">
                <h3>No items yet</h3>
                <p className="muted">Add the first content, blog, schedule, automation, or asset request below.</p>
              </div>
            ) : (
              <div className="quiet-list">
                {plan.items.map((item) => {
                  const updateStatus = updateContentPlanItemStatusAction.bind(null, plan.id, item.id);
                  const deleteItem = deleteContentPlanItemAction.bind(null, plan.id, item.id);
                  const reviewItem = reviewPlanItemQualityAction.bind(null, plan.id, item.id);
                  const promoteItem = promoteContentPlanItemAction.bind(null, plan.id, item.id);
                  const latestReview = item.qualityReviews[0] ?? null;
                  const canSchedule = Boolean(item.scheduledFor);

                  return (
                    <article className="quiet-row" key={item.id}>
                      <div className="quiet-row__main">
                        <div className="quiet-row__title">
                          <strong>{item.title}</strong>
                          <StatusBadge label={item.status} />
                        </div>
                        <p className="muted">{item.brief ?? item.assetRequest ?? "No brief added yet"}</p>
                        <div className="quiet-meta">
                          <span>{item.itemType}</span>
                          <span>{item.channel ?? "No channel"}</span>
                          <span>{formatScheduled(item.scheduledFor)}</span>
                          <span>{item.brand ?? plan.brand ?? "No brand"}</span>
                        </div>
                        <div className="quiet-meta">
                          {item.content ? <Link href={`/content/${item.content.id}`}>Content: {item.content.title}</Link> : null}
                          {item.blog ? <Link href={`/blogs/${item.blog.id}`}>Blog: {item.blog.title}</Link> : null}
                          {item.schedule ? <Link href={`/schedule/${item.schedule.id}`}>Schedule entry</Link> : null}
                          {latestReview ? <span>Quality {latestReview.overallScore}/100</span> : <span>Not reviewed</span>}
                        </div>
                      </div>
                      <div className="stack">
                        <form action={updateStatus} className="status-control">
                          <select name="status" defaultValue={item.status} aria-label={`Status for ${item.title}`}>
                            {["planned", "approved", "created", "scheduled", "published", "blocked", "cancelled"].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button className="button button--secondary" type="submit">
                            Save
                          </button>
                        </form>
                        <form action={reviewItem} className="status-control">
                          <button className="button button--secondary" type="submit">
                            Review
                          </button>
                        </form>
                        <form action={deleteItem} className="status-control">
                          <button className="button button--secondary" type="submit">
                            Delete item
                          </button>
                        </form>
                        <form action={promoteItem} className="plan-promote-actions">
                          {!item.content ? (
                            <button className="button button--secondary" name="target" type="submit" value="content">
                              Create content
                            </button>
                          ) : null}
                          {!item.blog ? (
                            <button className="button button--secondary" name="target" type="submit" value="blog">
                              Create blog
                            </button>
                          ) : null}
                          {!item.schedule && canSchedule ? (
                            <button className="button button--primary" name="target" type="submit" value="schedule">
                              Schedule
                            </button>
                          ) : null}
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
      </div>

      {isAddingItem ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close add item" href={`/plans/${plan.id}`} />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Planning</p>
                <h3>Add plan item</h3>
                <p className="muted">Create one planned unit for content, blog, schedule, asset, or automation work.</p>
              </div>
              <Link className="button button--secondary" href={`/plans/${plan.id}`}>
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <PlanItemForm action={addItem} plan={plan} />
            </div>
          </div>
        </div>
      ) : null}

      {isEditingPlan ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close plan editor" href={`/plans/${plan.id}`} />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Plan settings</p>
                <h3>Edit brief</h3>
                <p className="muted">Update the plan goal, window, brand, campaign, and source prompt.</p>
              </div>
              <Link className="button button--secondary" href={`/plans/${plan.id}`}>
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <PlanForm action={updatePlan} plan={plan} submitLabel="Save plan" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
