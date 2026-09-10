import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ContentPlanItemStatus, type ContentPlanItem } from "@prisma/client";
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
  updateContentPlanItemAction,
  updateContentPlanItemStatusAction,
} from "../actions";

type PlanDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    add?: string;
    edit?: string;
    editItem?: string;
    status?: string;
    brand?: string;
    channel?: string;
    type?: string;
  }>;
};

const statusLanes = [
  ContentPlanItemStatus.planned,
  ContentPlanItemStatus.approved,
  ContentPlanItemStatus.created,
  ContentPlanItemStatus.scheduled,
  ContentPlanItemStatus.published,
  ContentPlanItemStatus.blocked,
  ContentPlanItemStatus.cancelled,
];

const allStatuses = Object.values(ContentPlanItemStatus);

function formatDate(date: Date | null) {
  return date ? format(date, "MMM d, yyyy") : "Not set";
}

function formatScheduled(date: Date | null) {
  return date ? format(date, "MMM d, p") : "Unscheduled";
}

function filterHref(planId: string, key: string, value?: string | null) {
  const params = new URLSearchParams();
  if (value) params.set(key, value);
  return `/plans/${planId}${params.size ? `?${params.toString()}` : ""}`;
}

function nextBestAction(item: ContentPlanItem & { qualityReviews: Array<{ overallScore: number }> }) {
  if (item.status === ContentPlanItemStatus.blocked) return "Resolve blocker or rewrite the brief.";
  if (!item.brief && !item.assetRequest) return "Add a stronger brief before promotion.";
  if (item.qualityReviews.length === 0) return "Run quality review.";
  if (item.qualityReviews[0].overallScore < 75) return "Improve the item from quality feedback.";
  if (!item.contentId && !item.blogId) return item.itemType === "blog" ? "Promote into blog draft." : "Promote into content draft.";
  if (!item.scheduleId) return item.scheduledFor ? "Promote into schedule." : "Set a scheduled date.";
  return "Track through approval and publishing.";
}

export default async function PlanDetailPage({ params, searchParams }: PlanDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isAddingItem = resolvedSearchParams?.add === "1";
  const isEditingPlan = resolvedSearchParams?.edit === "1";
  const editingItemId = resolvedSearchParams?.editItem;
  const [plan, brandProfiles] = await Promise.all([
    prisma.contentPlan.findUnique({
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
    }),
    prisma.brandProfile.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
  ]);

  if (!plan) {
    notFound();
  }

  const updatePlan = updateContentPlanAction.bind(null, plan.id);
  const deletePlan = deleteContentPlanAction.bind(null, plan.id);
  const addItem = addContentPlanItemAction.bind(null, plan.id);
  const editingItem = editingItemId ? plan.items.find((item) => item.id === editingItemId) : null;
  const updateItem = editingItem ? updateContentPlanItemAction.bind(null, plan.id, editingItem.id) : null;

  const activeStatus = allStatuses.includes(resolvedSearchParams?.status as ContentPlanItemStatus)
    ? resolvedSearchParams?.status
    : null;
  const activeBrand = resolvedSearchParams?.brand ?? null;
  const activeChannel = resolvedSearchParams?.channel ?? null;
  const activeType = resolvedSearchParams?.type ?? null;

  const brands = Array.from(new Set(plan.items.map((item) => item.brand ?? plan.brand).filter(Boolean))).sort();
  const channels = Array.from(new Set(plan.items.map((item) => item.channel).filter(Boolean))).sort();
  const types = Array.from(new Set(plan.items.map((item) => item.itemType))).sort();
  const filteredItems = plan.items.filter((item) => {
    if (activeStatus && item.status !== activeStatus) return false;
    if (activeBrand && (item.brand ?? plan.brand) !== activeBrand) return false;
    if (activeChannel && item.channel !== activeChannel) return false;
    if (activeType && item.itemType !== activeType) return false;
    return true;
  });

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

        <section className="quiet-panel plan-board-shell">
          <div className="section-heading">
            <div>
              <p className="kicker">Production board</p>
              <h3>{filteredItems.length} visible item{filteredItems.length === 1 ? "" : "s"}</h3>
            </div>
            <Link className="button button--secondary" href={`/plans/${plan.id}`}>
              Clear filters
            </Link>
          </div>

          <div className="plan-filter-bar">
            <Link className="inline-chip" data-active={!activeStatus && !activeBrand && !activeChannel && !activeType} href={`/plans/${plan.id}`}>
              All
            </Link>
            {allStatuses.map((status) => (
              <Link className="inline-chip" data-active={activeStatus === status} href={filterHref(plan.id, "status", status)} key={status}>
                {status}
              </Link>
            ))}
          </div>

          <div className="plan-filter-bar">
            {brands.map((brand) => (
              <Link className="inline-chip" data-active={activeBrand === brand} href={filterHref(plan.id, "brand", brand)} key={brand}>
                {brand}
              </Link>
            ))}
            {channels.map((channel) => (
              <Link className="inline-chip" data-active={activeChannel === channel} href={filterHref(plan.id, "channel", channel)} key={channel}>
                {channel}
              </Link>
            ))}
            {types.map((type) => (
              <Link className="inline-chip" data-active={activeType === type} href={filterHref(plan.id, "type", type)} key={type}>
                {type}
              </Link>
            ))}
          </div>

          {plan.items.length === 0 ? (
            <div className="empty-state empty-state--quiet">
              <h3>No items yet</h3>
              <p className="muted">Add the first content, blog, schedule, automation, or asset request below.</p>
            </div>
          ) : (
            <div className="plan-board">
              {statusLanes.map((status) => {
                const laneItems = filteredItems.filter((item) => item.status === status);

                return (
                  <div className="plan-lane" key={status}>
                    <div className="plan-lane__header">
                      <strong>{status}</strong>
                      <span>{laneItems.length}</span>
                    </div>

                    <div className="plan-lane__items">
                      {laneItems.length === 0 ? (
                        <p className="muted">No items</p>
                      ) : (
                        laneItems.map((item) => {
                          const updateStatus = updateContentPlanItemStatusAction.bind(null, plan.id, item.id);
                          const deleteItem = deleteContentPlanItemAction.bind(null, plan.id, item.id);
                          const reviewItem = reviewPlanItemQualityAction.bind(null, plan.id, item.id);
                          const promoteItem = promoteContentPlanItemAction.bind(null, plan.id, item.id);
                          const latestReview = item.qualityReviews[0] ?? null;
                          const canSchedule = Boolean(item.scheduledFor);

                          return (
                            <article className="plan-card" key={item.id}>
                              <div className="plan-card__header">
                                <strong>{item.title}</strong>
                                <StatusBadge label={item.itemType} />
                              </div>

                              <p className="muted">{item.brief ?? item.assetRequest ?? "No brief added yet"}</p>

                              <div className="quiet-meta">
                                <span>{item.channel ?? "No channel"}</span>
                                <span>{formatScheduled(item.scheduledFor)}</span>
                                <span>{item.brand ?? plan.brand ?? "No brand"}</span>
                              </div>

                              <div className="plan-card__links">
                                {item.content ? <Link href={`/content/${item.content.id}`}>Content</Link> : null}
                                {item.blog ? <Link href={`/blogs/${item.blog.id}`}>Blog</Link> : null}
                                {item.schedule ? <Link href={`/schedule/${item.schedule.id}`}>Schedule</Link> : null}
                                {latestReview ? <span>Quality {latestReview.overallScore}/100</span> : <span>Not reviewed</span>}
                              </div>

                              <div className="plan-next-action">{nextBestAction(item)}</div>

                              <form action={updateStatus} className="status-control status-control--compact">
                                <select name="status" defaultValue={item.status} aria-label={`Status for ${item.title}`}>
                                  {allStatuses.map((statusOption) => (
                                    <option key={statusOption} value={statusOption}>
                                      {statusOption}
                                    </option>
                                  ))}
                                </select>
                                <button className="button button--secondary" type="submit">
                                  Save
                                </button>
                              </form>

                              <div className="plan-card__actions">
                                <Link className="button button--secondary" href={`/plans/${plan.id}?editItem=${item.id}`}>
                                  Edit
                                </Link>
                                <form action={reviewItem}>
                                  <button className="button button--secondary" type="submit">
                                    Review
                                  </button>
                                </form>
                                <form action={deleteItem}>
                                  <button className="button button--secondary" type="submit">
                                    Delete
                                  </button>
                                </form>
                              </div>

                              <form action={promoteItem} className="plan-promote-actions">
                                {!item.content ? (
                                  <button className="button button--secondary" name="target" type="submit" value="content">
                                    Content
                                  </button>
                                ) : null}
                                {!item.blog ? (
                                  <button className="button button--secondary" name="target" type="submit" value="blog">
                                    Blog
                                  </button>
                                ) : null}
                                {!item.schedule && canSchedule ? (
                                  <button className="button button--primary" name="target" type="submit" value="schedule">
                                    Schedule
                                  </button>
                                ) : null}
                              </form>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
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
              <PlanItemForm action={addItem} brandProfiles={brandProfiles} plan={plan} />
            </div>
          </div>
        </div>
      ) : null}

      {editingItem && updateItem ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close item editor" href={`/plans/${plan.id}`} />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Plan item</p>
                <h3>Edit item</h3>
                <p className="muted">Tune the brief, schedule target, metadata, and production state.</p>
              </div>
              <Link className="button button--secondary" href={`/plans/${plan.id}`}>
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <PlanItemForm
                action={updateItem}
                brandProfiles={brandProfiles}
                item={editingItem}
                plan={plan}
                submitLabel="Save item"
              />
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
              <PlanForm action={updatePlan} brandProfiles={brandProfiles} plan={plan} submitLabel="Save plan" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
