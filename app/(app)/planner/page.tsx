import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryStats } from "@/components/ui/summary-stats";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { AiPlanForm } from "@/components/planner/ai-plan-form";
import { safeListCampaigns } from "@/lib/campaigns/client";
import { getContentCommandCenter } from "@/lib/planner/content-command-center";
import { prisma } from "@/lib/prisma";
import { generateAiContentPlanAction } from "./actions";

export const dynamic = "force-dynamic";

type PlannerPageProps = {
  searchParams?: Promise<{ generate?: string }>;
};

function formatPercent(value: number | null) {
  if (value === null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function chatPromptHref(prompt: string) {
  return `/chat?prompt=${encodeURIComponent(prompt)}`;
}

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [planner, brandProfiles, campaignsResponse] = await Promise.all([
    getContentCommandCenter(),
    prisma.brandProfile.findMany({
      select: { brandName: true },
      orderBy: { brandName: "asc" },
    }),
    safeListCampaigns({ limit: 100 }),
  ]);
  const campaigns = campaignsResponse.ok ? campaignsResponse.data : [];
  const isGenerating = resolvedSearchParams?.generate === "1";

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Planner"
        description="A command cockpit for turning campaigns, drafts, assets, automation health, and performance signals into a weekly content plan."
      />

      <div className="toolbar">
        <div className="toolbar__group">
          <span className="inline-chip">Next 14 days</span>
          <span className="inline-chip">Planner cockpit</span>
        </div>
        <div className="toolbar__group">
          <div className="header-actions">
            <Link className="button button--secondary" href="/chat">
              Ask Quill
            </Link>
            <Link className="button button--primary" href="/schedule">
              Open calendar
            </Link>
          </div>
        </div>
      </div>

      <div className="stack">
        <SummaryStats items={planner.metrics} />

        <section className="card card--padded planner-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">AI planning actions</p>
              <h3>Use Quill as the creative operator</h3>
            </div>
            <div className="header-actions">
              <Link className="button button--primary" href="/planner?generate=1">
                Generate AI plan
              </Link>
              <Link className="button button--secondary" href="/chat">
                Open chat
              </Link>
              <Link className="button button--secondary" href="/plans/new">
                Save manually
              </Link>
            </div>
          </div>

          <div className="planner-action-grid">
            {planner.planningActions.map((action) => (
              <Link className="planner-action-card" href={chatPromptHref(action.prompt)} key={action.title}>
                <div>
                  <strong>{action.title}</strong>
                  <p className="muted">{action.detail}</p>
                </div>
                <span className="inline-chip">Load prompt</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="planner-grid">
          <article className="card card--padded planner-panel planner-panel--wide">
            <div className="section-heading">
              <div>
                <p className="kicker">Planning gaps</p>
                <h3>What needs the operator first</h3>
              </div>
              <span className="inline-chip">
                {planner.strategyGaps.length} open signal{planner.strategyGaps.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="planner-gap-list">
              {planner.strategyGaps.length === 0 ? (
                <div className="card card--padded empty-state">
                  <h3>Planner looks clear</h3>
                  <p className="muted">
                    Content records, blogs, schedule entries, and automation queues are not reporting
                    immediate blockers.
                  </p>
                </div>
              ) : (
                planner.strategyGaps.map((gap) => (
                  <div className="planner-gap-card" key={gap.title}>
                    <div>
                      <strong>{gap.title}</strong>
                      <p className="muted">{gap.detail}</p>
                    </div>
                    <Link className="button button--secondary" href={gap.actionHref}>
                      {gap.actionLabel}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="card card--padded planner-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Automation</p>
                <h3>Generation readiness</h3>
              </div>
              <Link className="button button--secondary" href="/automations">
                Manage
              </Link>
            </div>
            <div className="planner-score-list">
              <div className="status-row">
                <span>Active workflows</span>
                <strong>{planner.automationHealth.active}</strong>
              </div>
              <div className="status-row">
                <span>Due now</span>
                <strong>{planner.automationHealth.dueNow}</strong>
              </div>
              <div className="status-row">
                <span>Recent failures</span>
                <strong>{planner.automationHealth.failedRecently}</strong>
              </div>
              <div className="status-row">
                <span>Next due</span>
                <strong>
                  {planner.automationHealth.nextDue?.nextRunAt
                    ? format(planner.automationHealth.nextDue.nextRunAt as Date, "MMM d, p")
                    : "Manual"}
                </strong>
              </div>
            </div>
          </article>
        </section>

        <section className="planner-grid">
          <article className="card card--padded planner-panel planner-panel--wide">
            <div className="section-heading">
              <div>
                <p className="kicker">Brand coverage</p>
                <h3>Next two-week operating load</h3>
              </div>
            <Link className="button button--secondary" href="/schedule">
              Tune schedule
            </Link>
            <Link className="button button--secondary" href="/plans">
              Open plans
            </Link>
            </div>

            <div className="planner-brand-table">
              <div className="planner-brand-table__header">
                <span>Brand</span>
                <span>Scheduled</span>
                <span>Ready</span>
                <span>Attention</span>
                <span>Drafts</span>
                <span>Campaigns</span>
              </div>
              {planner.brandCoverage.length === 0 ? (
                <div className="card card--padded empty-state">
                  <h3>No brand coverage yet</h3>
                  <p className="muted">Create content, campaigns, or scheduled posts to populate this view.</p>
                </div>
              ) : (
                planner.brandCoverage.map((brand) => (
                  <div className="planner-brand-row" key={brand.brand}>
                    <strong>{brand.brand}</strong>
                    <span>{brand.scheduled}</span>
                    <span>{brand.ready}</span>
                    <span>{brand.attention}</span>
                    <span>{brand.drafts + brand.blogs}</span>
                    <span>{brand.campaigns}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="card card--padded planner-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Channels</p>
                <h3>Publishing mix</h3>
              </div>
            </div>
            <div className="planner-score-list">
              {planner.channelLoad.length === 0 ? (
                <p className="muted">No upcoming channels assigned.</p>
              ) : (
                planner.channelLoad.map((channel) => (
                  <div className="status-row" key={channel.label}>
                    <span>{channel.label}</span>
                    <strong>{channel.value}</strong>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="planner-grid">
          <article className="card card--padded planner-panel planner-panel--wide">
            <div className="section-heading">
              <div>
                <p className="kicker">Upcoming schedule</p>
                <h3>Ready state and blockers</h3>
              </div>
              <Link className="button button--secondary" href="/schedule?queue=attention">
                Review blockers
              </Link>
            </div>

            <div className="planner-schedule-list">
              {planner.upcomingSchedule.length === 0 ? (
                <div className="card card--padded empty-state">
                  <h3>No upcoming schedule entries</h3>
                  <p className="muted">
                    Use the calendar or ask Quill to draft a plan for the next campaign window.
                  </p>
                </div>
              ) : (
                planner.upcomingSchedule.map((item) => (
                  <Link className="planner-schedule-card" href={`/schedule/${item.id}`} key={item.id}>
                    <div>
                      <div className="planner-schedule-card__top">
                        <strong>{item.title}</strong>
                        <StatusBadge label={item.isReady ? "ready" : "warning"} />
                      </div>
                      <p className="muted">
                        {format(item.scheduledFor, "EEE, MMM d, p")} · {item.channel ?? "No channel"} · {item.brand ?? "No brand"}
                      </p>
                      {!item.isReady ? (
                        <p className="planner-warning">
                          {item.reasons.slice(0, 2).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge label={item.status} />
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="card card--padded planner-panel">
            <div className="section-heading">
              <div>
                <p className="kicker">Performance</p>
                <h3>Signals for the next plan</h3>
              </div>
              <Link className="button button--secondary" href="/analytics">
                Analytics
              </Link>
            </div>
            <div className="planner-score-list">
              <div className="status-row">
                <span>Recent published posts</span>
                <strong>{planner.performanceSignals.recentPublishedCount}</strong>
              </div>
              <div className="status-row">
                <span>Active platforms</span>
                <strong>{planner.performanceSignals.activePlatforms.length}</strong>
              </div>
              {planner.performanceSignals.topPosts.length > 0 ? (
                planner.performanceSignals.topPosts.map((post) => (
                  <div className="planner-performance-card" key={post.id}>
                    <strong>{post.title}</strong>
                    <p className="muted">
                      {post.platform} · {formatPercent(post.engagementRate)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="muted">
                  No engagement snapshots yet. Import analytics or complete social sync to make planning
                  performance-aware.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="card card--padded planner-panel">
          <div className="section-heading">
            <div>
              <p className="kicker">Campaign windows</p>
              <h3>Promotional moments that should shape the plan</h3>
            </div>
            <Link className="button button--secondary" href="/campaigns">
              Open campaigns
            </Link>
          </div>

          {!planner.campaigns.ok ? (
            <div className="card card--padded empty-state">
              <h3>Campaign API needs attention</h3>
              <p className="muted">{planner.campaigns.error ?? "Campaigns are unavailable."}</p>
            </div>
          ) : planner.campaigns.upcoming.length === 0 ? (
            <div className="card card--padded empty-state">
              <h3>No active campaign windows</h3>
              <p className="muted">
                The planner is not seeing active or upcoming campaigns in the next 14 days.
              </p>
            </div>
          ) : (
            <div className="planner-campaign-grid">
              {planner.campaigns.upcoming.map((campaign) => (
                <Link className="planner-campaign-card" href={`/campaigns/${campaign.campaign_id}`} key={campaign.campaign_id}>
                  <div>
                    <strong>{campaign.campaign_name}</strong>
                    <p className="muted">
                      {campaign.brand.join(", ") || "No brand"} · {campaign.campaign_type ?? "Campaign"}
                    </p>
                  </div>
                  <div className="planner-campaign-card__footer">
                    <StatusBadge label={campaign.campaign_status} />
                    <span className="inline-chip">
                      {campaign.start_date ? format(new Date(campaign.start_date), "MMM d") : "TBD"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {isGenerating ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close AI plan generator" href="/planner" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">AI planning brief</p>
                <h3>Generate a focused content plan</h3>
                <p className="muted">
                  Choose the direction, or leave fields blank and Quill will use the strongest current signals.
                </p>
              </div>
              <Link className="button button--secondary" href="/planner">
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <AiPlanForm
                action={generateAiContentPlanAction}
                brandProfiles={brandProfiles}
                campaigns={campaigns}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
