import Link from "next/link";
import { format } from "date-fns";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryStats } from "@/components/ui/summary-stats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatWindow(startDate: Date | null, endDate: Date | null) {
  if (!startDate && !endDate) return "No dates set";
  if (startDate && endDate) return `${format(startDate, "MMM d")} to ${format(endDate, "MMM d")}`;
  return format((startDate ?? endDate) as Date, "MMM d");
}

export default async function PlansPage() {
  const [plans, openItems, blockedItems] = await Promise.all([
    prisma.contentPlan.findMany({
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: [{ scheduledFor: "asc" }, { sortOrder: "asc" }],
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.contentPlanItem.count({
      where: { status: { in: ["planned", "approved", "created"] } },
    }),
    prisma.contentPlanItem.count({ where: { status: "blocked" } }),
  ]);

  const activePlans = plans.filter((plan) => ["draft", "review", "approved", "active"].includes(plan.status));

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Plans"
        description="A calmer planning workspace for turning AI strategy into approved content, blog, asset, and schedule work."
        actions={
          <Link className="button button--primary" href="/plans/new">
            New plan
          </Link>
        }
      />

      <div className="stack">
        <SummaryStats
          items={[
            {
              label: "Active plans",
              value: activePlans.length,
              detail: "Draft, review, approved, or active plans",
            },
            {
              label: "Open items",
              value: openItems,
              detail: "Planned work not yet scheduled or published",
            },
            {
              label: "Blocked",
              value: blockedItems,
              detail: "Items waiting for a decision, asset, or missing context",
            },
            {
              label: "Total plans",
              value: plans.length,
              detail: "Stored plans available to Quill and Atlas",
            },
          ]}
        />

        <section className="quiet-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Planning desk</p>
              <h3>Current plans</h3>
            </div>
            <div className="toolbar__group">
              <Link className="button button--secondary" href="/planner">
                Open planner
              </Link>
              <Link className="button button--secondary" href="/chat?prompt=Create%20a%20content%20plan%20for%20the%20next%2014%20days%20using%20brand%20profiles%2C%20campaigns%2C%20draft%20queues%2C%20assets%2C%20and%20publishing%20readiness.">
                Ask Quill
              </Link>
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="empty-state empty-state--quiet">
              <h3>No plans yet</h3>
              <p className="muted">Create the first plan manually, or ask Quill to draft one from the command-center signals.</p>
            </div>
          ) : (
            <div className="quiet-list">
              {plans.map((plan) => (
                <Link className="quiet-row quiet-row--link" href={`/plans/${plan.id}`} key={plan.id}>
                  <div className="quiet-row__main">
                    <div className="quiet-row__title">
                      <strong>{plan.title}</strong>
                      <StatusBadge label={plan.status} />
                    </div>
                    <p className="muted">
                      {plan.goal ?? plan.description ?? "No goal added yet"}
                    </p>
                    <div className="quiet-meta">
                      <span>{formatWindow(plan.startDate, plan.endDate)}</span>
                      <span>{plan.brand ?? "No brand"}</span>
                      <span>{plan.campaignName ?? "No campaign"}</span>
                    </div>
                  </div>
                  <div className="quiet-row__aside">
                    <strong>{plan._count.items}</strong>
                    <span className="muted">items</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
