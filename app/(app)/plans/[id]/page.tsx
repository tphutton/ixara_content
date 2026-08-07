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
  updateContentPlanAction,
  updateContentPlanItemStatusAction,
} from "../actions";

type PlanDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: Date | null) {
  return date ? format(date, "MMM d, yyyy") : "Not set";
}

function formatScheduled(date: Date | null) {
  return date ? format(date, "MMM d, p") : "Unscheduled";
}

export default async function PlanDetailPage({ params }: PlanDetailPageProps) {
  const { id } = await params;
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
            <Link className="button button--primary" href={`/chat?prompt=${encodeURIComponent(`Review this content plan and suggest the next best items to create. Plan id: ${plan.id}`)}`}>
              Ask Quill
            </Link>
          </div>
        }
      />

      <div className="plan-layout">
        <main className="stack">
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
                  const reviewItem = reviewPlanItemQualityAction.bind(null, plan.id, item.id);
                  const latestReview = item.qualityReviews[0] ?? null;

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
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="stack">
          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Add item</p>
                <h3>Next unit</h3>
              </div>
            </div>
            <PlanItemForm action={addItem} plan={plan} />
          </section>

          <section className="quiet-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Plan settings</p>
                <h3>Edit brief</h3>
              </div>
            </div>
            <PlanForm action={updatePlan} plan={plan} submitLabel="Save plan" />
          </section>
        </aside>
      </div>
    </section>
  );
}
