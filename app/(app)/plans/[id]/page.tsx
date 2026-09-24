import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ContentPlanItemStatus, EditorialApprovalTargetType, type ContentPlanItem } from "@prisma/client";
import { EditorialApprovalPanel } from "@/components/approvals/editorial-approval-panel";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { PlanForm } from "@/components/plans/plan-form";
import { PlanItemForm } from "@/components/plans/plan-item-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPlanItemBriefReadiness } from "@/lib/plans/brief-readiness";
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
    viewItem?: string;
    status?: string;
    brand?: string;
    channel?: string;
    type?: string;
    brief?: string;
  }>;
};

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

function nextBestAction(
  item: ContentPlanItem & { qualityReviews: Array<{ overallScore: number }> },
  briefReady: boolean,
) {
  if (item.status === ContentPlanItemStatus.blocked) return "Resolve blocker or rewrite the brief.";
  if (!briefReady) return "Complete the production brief before promotion.";
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
  const isViewingBrief = resolvedSearchParams?.brief === "1";
  const editingItemId = resolvedSearchParams?.editItem;
  const viewingItemId = resolvedSearchParams?.viewItem;
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
      select: { id: true, brandName: true, targetAudience: true, defaultTone: true, preferredCTAs: true },
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
  const viewingItem = viewingItemId ? plan.items.find((item) => item.id === viewingItemId) : null;
  const updateItem = editingItem ? updateContentPlanItemAction.bind(null, plan.id, editingItem.id) : null;
  const brandProfileByName = new Map(
    brandProfiles.map((profile) => [profile.brandName.toLowerCase(), profile]),
  );

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
        stacked
        title={plan.title}
        description={plan.goal ?? plan.description ?? "Plan the creative work, then turn approved items into records and schedule entries."}
        actions={
          <>
            <Link className="button button--secondary" href="/plans">
              All plans
            </Link>
            <Link className="button button--secondary" href={`/plans/${plan.id}?edit=1`}>
              Edit plan
            </Link>
            <Link className="button button--secondary" href={`/plans/${plan.id}?brief=1`}>
              Plan brief
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
          </>
        }
      />

      <div className="stack">
        <div className="plan-summary-bar">
          <StatusBadge label={plan.status} />
          <span><strong>{plan.brand ?? "No brand"}</strong></span>
          <span>{plan.campaignName ?? "No campaign"}</span>
          <span>{formatDate(plan.startDate)} to {formatDate(plan.endDate)}</span>
          <span>{plan.items.length} item{plan.items.length === 1 ? "" : "s"}</span>
        </div>

        <section className="plan-table-workspace">
          <nav aria-label="Plan item status" className="plan-status-tabs">
            <Link data-active={!activeStatus} href={`/plans/${plan.id}`}>All <span>{plan.items.length}</span></Link>
            {allStatuses.map((status) => (
              <Link data-active={activeStatus === status} href={filterHref(plan.id, "status", status)} key={status}>
                {status} <span>{plan.items.filter((item) => item.status === status).length}</span>
              </Link>
            ))}
          </nav>

          <div className="toolbar toolbar--compact plan-table-toolbar">
            <div className="toolbar__group"><strong>{filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}</strong>{activeStatus ? <StatusBadge label={activeStatus} /> : null}</div>
            <details className="filter-disclosure">
              <summary className="button button--secondary">More filters</summary>
              <div className="filter-disclosure__panel plan-filter-popover">
                <p className="kicker">Brand</p><div className="plan-filter-bar">{brands.map((brand) => <Link className="inline-chip" data-active={activeBrand === brand} href={filterHref(plan.id, "brand", brand)} key={brand}>{brand}</Link>)}</div>
                <p className="kicker">Channel</p><div className="plan-filter-bar">{channels.map((channel) => <Link className="inline-chip" data-active={activeChannel === channel} href={filterHref(plan.id, "channel", channel)} key={channel}>{channel}</Link>)}</div>
                <p className="kicker">Type</p><div className="plan-filter-bar">{types.map((type) => <Link className="inline-chip" data-active={activeType === type} href={filterHref(plan.id, "type", type)} key={type}>{type}</Link>)}</div>
                <Link className="button button--secondary" href={`/plans/${plan.id}`}>Clear filters</Link>
              </div>
            </details>
          </div>

          {plan.items.length === 0 ? (
            <div className="empty-state empty-state--quiet">
              <h3>No items yet</h3>
              <p className="muted">Add the first content, blog, schedule, automation, or asset request below.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state empty-state--quiet"><h3>No matching items</h3><p className="muted">Choose another status or clear the additional filters.</p></div>
          ) : (
            <div className="table-shell">
              <table className="table plan-items-table">
                <thead><tr><th>Work item</th><th>Status</th><th>Channel & date</th><th>Brief</th><th>Quality</th><th>Output</th><th>Next action</th><th aria-label="Actions" /></tr></thead>
                <tbody>{filteredItems.map((item) => {
                  const deleteItem = deleteContentPlanItemAction.bind(null, plan.id, item.id);
                  const latestReview = item.qualityReviews[0] ?? null;
                  const profile = brandProfileByName.get((item.brand ?? plan.brand ?? "").toLowerCase()) ?? null;
                  const readiness = getPlanItemBriefReadiness(item, plan, profile);
                  return <tr key={item.id}>
                    <td><Link href={`/plans/${plan.id}?viewItem=${item.id}`}><strong>{item.title}</strong></Link><div className="table-subtext">{item.brand ?? plan.brand ?? "No brand"} · {item.itemType}</div></td>
                    <td><StatusBadge label={item.status} /></td>
                    <td><strong>{item.channel ?? "Not set"}</strong><div className="table-subtext">{formatScheduled(item.scheduledFor)}</div></td>
                    <td><strong>{readiness.score}%</strong><div className="table-subtext">{readiness.ready ? "Complete" : `${readiness.missing.length} fields missing`}</div></td>
                    <td>{latestReview ? <><strong>{latestReview.overallScore}/100</strong><div className="table-subtext">Reviewed</div></> : <span className="muted">Not reviewed</span>}</td>
                    <td>{item.schedule ? "Scheduled" : item.content ? "Content" : item.blog ? "Blog" : "Not created"}</td>
                    <td><div className="table-subtext plan-next-cell">{nextBestAction(item, readiness.ready)}</div></td>
                    <td><div className="row-actions table-actions"><Link className="button button--secondary" href={`/plans/${plan.id}?viewItem=${item.id}`}>View</Link><form action={deleteItem}><button className="button button--secondary" type="submit">Delete</button></form></div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {isViewingBrief ? (
        <div className="editor-overlay editor-overlay--dialog">
          <div className="editor-overlay__backdrop"><Link aria-label="Close plan brief" href={`/plans/${plan.id}`} /></div>
          <section className="editor-overlay__panel plan-detail-panel">
            <div className="editor-overlay__header"><div><p className="kicker">Plan brief</p><h3>{plan.title}</h3><StatusBadge label={plan.status} /></div><Link className="button button--secondary" href={`/plans/${plan.id}`}>Close</Link></div>
            <div className="editor-overlay__content stack">
              <div><p className="kicker">Goal</p><p>{plan.goal ?? "No goal added."}</p></div>
              <div><p className="kicker">Description</p><p>{plan.description ?? "No description added."}</p></div>
              <div className="metadata-grid"><div><span>Brand</span><strong>{plan.brand ?? "Not set"}</strong></div><div><span>Campaign</span><strong>{plan.campaignName ?? "Not set"}</strong></div><div><span>Starts</span><strong>{formatDate(plan.startDate)}</strong></div><div><span>Ends</span><strong>{formatDate(plan.endDate)}</strong></div></div>
              {plan.sourcePrompt ? <div><p className="kicker">Planning source</p><p className="muted">{plan.sourcePrompt}</p></div> : null}
              <EditorialApprovalPanel compact path={`/plans/${plan.id}?brief=1`} targetId={plan.id} targetType={EditorialApprovalTargetType.content_plan} />
            </div>
            <div className="editor-overlay__footer form-actions"><Link className="button button--primary" href={`/plans/${plan.id}?edit=1`}>Edit plan</Link></div>
          </section>
        </div>
      ) : null}

      {viewingItem ? (() => {
        const updateStatus = updateContentPlanItemStatusAction.bind(null, plan.id, viewingItem.id);
        const deleteItem = deleteContentPlanItemAction.bind(null, plan.id, viewingItem.id);
        const reviewItem = reviewPlanItemQualityAction.bind(null, plan.id, viewingItem.id);
        const promoteItem = promoteContentPlanItemAction.bind(null, plan.id, viewingItem.id);
        const latestReview = viewingItem.qualityReviews[0] ?? null;
        const profile = brandProfileByName.get((viewingItem.brand ?? plan.brand ?? "").toLowerCase()) ?? null;
        const readiness = getPlanItemBriefReadiness(viewingItem, plan, profile);
        return <div className="editor-overlay editor-overlay--dialog">
          <div className="editor-overlay__backdrop"><Link aria-label="Close plan item" href={`/plans/${plan.id}`} /></div>
          <section className="editor-overlay__panel plan-item-detail-panel">
            <div className="editor-overlay__header"><div><p className="kicker">{viewingItem.itemType} brief</p><h3>{viewingItem.title}</h3><div className="toolbar__group"><StatusBadge label={viewingItem.status} /><span className="inline-chip">{readiness.score}% complete</span>{latestReview ? <span className="inline-chip">Quality {latestReview.overallScore}/100</span> : null}</div></div><Link className="button button--secondary" href={`/plans/${plan.id}`}>Close</Link></div>
            <div className="editor-overlay__content stack">
              <div className="metadata-grid"><div><span>Brand</span><strong>{readiness.effective.brand ?? "Not set"}</strong></div><div><span>Campaign</span><strong>{readiness.effective.campaignName ?? "Not set"}</strong></div><div><span>Channel</span><strong>{viewingItem.channel ?? "Not set"}</strong></div><div><span>Scheduled</span><strong>{formatScheduled(viewingItem.scheduledFor)}</strong></div></div>
              {!readiness.ready ? <div className="plan-brief-gaps"><strong>Brief gaps:</strong> {readiness.missing.map((gap) => gap.label).join(", ")}</div> : null}
              <div><p className="kicker">Creative brief</p><p>{viewingItem.brief ?? "No brief added."}</p></div>
              <div className="plan-detail-grid"><div><p className="kicker">Objective</p><p>{readiness.effective.objective ?? "Not set"}</p></div><div><p className="kicker">Audience</p><p>{readiness.effective.targetAudience ?? "Not set"}</p></div><div><p className="kicker">Key message</p><p>{readiness.effective.keyMessage ?? "Not set"}</p></div><div><p className="kicker">CTA & tone</p><p>{readiness.effective.callToAction ?? "No CTA"} · {readiness.effective.tone ?? "No tone"}</p></div></div>
              <div><p className="kicker">Asset direction</p><p>{viewingItem.assetRequest ?? "No asset direction added."}</p></div>
              <div><p className="kicker">Next action</p><p className="quality-next-step">{nextBestAction(viewingItem, readiness.ready)}</p></div>
              <EditorialApprovalPanel compact path={`/plans/${plan.id}?viewItem=${viewingItem.id}`} targetId={viewingItem.id} targetType={EditorialApprovalTargetType.content_plan_item} />
              <form action={updateStatus} className="status-control"><select name="status" defaultValue={viewingItem.status} aria-label={`Status for ${viewingItem.title}`}>{allStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="button button--secondary" type="submit">Update status</button></form>
              <div className="toolbar__group">{viewingItem.content ? <Link className="button button--secondary" href={`/content/${viewingItem.content.id}`}>Open content</Link> : null}{viewingItem.blog ? <Link className="button button--secondary" href={`/blogs/${viewingItem.blog.id}`}>Open blog</Link> : null}{viewingItem.schedule ? <Link className="button button--secondary" href={`/schedule/${viewingItem.schedule.id}`}>Open schedule</Link> : null}</div>
            </div>
            <div className="editor-overlay__footer plan-detail-actions">
              <Link className="button button--primary" href={`/plans/${plan.id}?editItem=${viewingItem.id}`}>{readiness.ready ? "Edit brief" : "Complete brief"}</Link>
              <form action={reviewItem}><button className="button button--secondary" type="submit">Run quality review</button></form>
              {readiness.ready ? <form action={promoteItem} className="toolbar__group">{!viewingItem.content ? <button className="button button--secondary" name="target" type="submit" value="content">Create content</button> : null}{!viewingItem.blog ? <button className="button button--secondary" name="target" type="submit" value="blog">Create blog</button> : null}{!viewingItem.schedule && viewingItem.scheduledFor ? <button className="button button--secondary" name="target" type="submit" value="schedule">Create schedule</button> : null}</form> : null}
              <form action={deleteItem}><button className="button button--secondary" type="submit">Delete</button></form>
            </div>
          </section>
        </div>;
      })() : null}

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
