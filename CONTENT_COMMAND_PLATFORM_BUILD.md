# Content Command Platform Build Plan

This document extends the original Content Ops AI build into a world-class content creation, planning, publishing, and intelligence platform connected to the Ixara AI Command Center.

## Objective

Turn `content.ixara.tech` into the operating workspace where Ixara can plan campaigns, generate creative, manage editorial quality, coordinate approvals, publish to channels, and learn from performance. `ai.ixara.tech` and Atlas should feed strategy, approvals, business signals, and cross-app recommendations into this app.

## Product Direction

The app should move from record management to an editorial command system:

- Planner-first workspace for weekly and campaign-led operations.
- Brief-to-draft-to-variant content lifecycle.
- AI creative director workflows powered by Atlas and Quill.
- Brand-safe content generation and review.
- Publishing-ready asset packaging.
- Social account connection, sync, publishing, and retry handling.
- Performance feedback loops that improve future plans.
- Collaboration, approvals, and auditability for AI-assisted publishing.
- A strict content quality layer that reviews brand fit, audience specificity, clarity, channel fit, conversion strength, and publishing risk before work goes live.

## Phase 1: Planner Cockpit

Status: in progress

- [x] Add `/planner` as the content command cockpit.
- [x] Surface campaign windows, schedule readiness, draft queues, automation health, asset availability, and performance signals in one page.
- [x] Add brand coverage and channel-load views for the next two-week operating window.
- [x] Deep-link gaps into content, blog, schedule, automation, social, and analytics workspaces.
- [x] Align the content app visual system with the dark Ixara Command Center shell, including the full Ixara PNG logo on black.
- [x] Add AI planning action cards that load strategic prompts into Quill.
- [x] Add saved `/plans` workspace so planning decisions become durable artifacts rather than chat-only prompts.
- [x] Add Quill/Atlas tools to list plans, create plans, and add plan items.
- [x] Add `/api/external/planner/summary` so Atlas and the Command Center can read planner intelligence directly.
- [x] Restructure the sidebar into Command, Creation, Operations, Intelligence, and Admin groups.
- [x] Begin simplifying the UI with quieter plan panels, shorter controls, and flatter command surfaces.
- [ ] Add one-click AI plan generation from the planner that creates a plan plus suggested items in one guided flow.
- [ ] Add drag-and-drop rescheduling and channel swimlanes to the planning surface.
- [ ] Add gap heatmaps by brand, channel, sport, region, campaign, and week.

## Phase 2: Content Lifecycle Model

Status: started

- [x] Add first saved plan/item layer for briefs, schedule targets, asset requests, and automation work.
- [x] Link plan items to generated short-form content, blogs, and schedule entries.
- [x] Add saved AI quality reviews for content, blogs, and plan items.
- [ ] Promote plan items into full first-class content briefs with owners, due dates, and approval stages.
- [ ] Add channel-specific variants for Instagram, Facebook, LinkedIn, email, ads, and blog excerpts.
- [ ] Add version history, diff review, and revert support.
- [ ] Add owner, assignee, due date, priority, and editorial stage fields.
- [ ] Add approval comments and change-request loops.

## Phase 3: AI Creative Director

Status: started

- [x] Expand brand profiles with positioning, content pillars, personas, offers, proof points, SEO terms, competitors, voice examples, visual guidelines, and channel-specific guidance.
- [x] Add brand-profile AI readiness scoring in Settings.
- [x] Feed richer brand intelligence into Quill and brand-profile tools.
- [ ] Add Atlas workflow: build next week’s content plan from business signals.
- [ ] Add Atlas workflow: turn a campaign into a launch calendar.
- [ ] Add Atlas workflow: generate multi-channel variants from one brief or blog.
- [ ] Add Atlas workflow: improve weak hooks, CTAs, metadata, and asset fit.
- [ ] Feed sales, inventory, campaigns, finance constraints, and content performance into planning recommendations.
- [x] Persist AI planning decisions as plan and plan-item artifacts for review.
- [x] Add a strict AI editorial quality reviewer with saved scores, verdicts, issues, recommendations, and suggested hook/CTA rewrites.
- [x] Expose quality review to Quill and Atlas through the controlled tool layer.
- [ ] Add guided “apply quality recommendations” actions that rewrite records while preserving operator review.

## Phase 3A: Quality System

Status: started

- [x] Add `QualityReview` persistence for content, blogs, and plan items.
- [x] Score brand fit, audience fit, clarity, channel fit, conversion strength, and publishing risk.
- [x] Add quality panels to content/blog detail pages.
- [x] Add plan-item quality review from the saved plan workspace.
- [x] Add Quill/Atlas `review_quality` tool.
- [ ] Block or warn before approving/scheduling items with low latest quality scores.
- [ ] Add one-click rewrite actions from review recommendations.
- [ ] Add team-level quality dashboard and trend tracking.

## Phase 4: Asset Studio

Status: planned

- [ ] Add asset detail pages with usage history.
- [ ] Add asset suitability scoring by brand, channel, and campaign.
- [ ] Add section-level blog media slots and publishing variants.
- [ ] Add missing-asset queue.
- [ ] Add platform crop/format metadata.
- [ ] Add generated image brief support.

## Phase 5: Distribution And Sync

Status: planned

- [ ] Finish Meta OAuth hardening and token refresh.
- [ ] Add scheduled background sync jobs for connected accounts.
- [ ] Add platform publishing workflows.
- [ ] Add publishing previews per channel.
- [ ] Add publishing approval gates.
- [ ] Add failure/retry queue.
- [ ] Track published URLs and delivery status back to schedule/content/blog records.

## Phase 6: Analytics-To-Planning Intelligence

Status: planned

- [ ] Add top posts by brand, channel, topic, hook, and format.
- [ ] Add best-time and cadence suggestions.
- [ ] Add topic cluster performance.
- [ ] Add campaign performance summaries.
- [ ] Add “repeat this pattern” AI actions.
- [ ] Add planning recommendations from performance deltas.

## Phase 7: Collaboration And Governance

Status: planned

- [ ] Add comments on content, blogs, schedule entries, briefs, and campaigns.
- [ ] Add approval inbox and bulk approval flows.
- [ ] Add notifications for blockers, due reviews, failed publishes, and automation runs.
- [ ] Add visible record-level audit trails.
- [ ] Add permission refinement for creator, editor, approver, admin, and viewer roles.

## Atlas / Command Center Integration

Atlas should use `mcp.ixara.tech` as the governed action layer and `content.ixara.tech` external APIs as the content source of truth.

Near-term integration targets:

- Planner gap summaries visible in `ai.ixara.tech` Content and Today views.
- Atlas commands that create briefs, drafts, schedule entries, and review artifacts.
- Approval actions in Command Center that execute back into `content.ixara.tech`.
- Cross-app signals from sales, inventory, campaigns, and finance shaping content recommendations.

## Current Implementation Notes

- The original Content Ops build is mostly complete for internal CRUD, chat tools, brand profiles, assets, automations, and planning visibility.
- The new `/planner` route is additive and does not replace `/schedule`.
- `/plans` is now the durable plan layer. The intended flow is Planner/Command Center signal review -> Quill/Atlas plan creation -> plan-item approval -> content/blog/schedule creation.
- Quality reviews now form the first editorial gate. The intended flow is draft/plan item -> quality review -> apply recommendations -> approve/schedule/publish.
- Social publishing is still the biggest missing capability before the product becomes end-to-end.
- Brand profiles now have enough structure to become the core AI memory layer for brand-safe generation, but saved profile quality still depends on the operator filling the readiness gaps in Settings.
- UI simplification has started with the plan workspace. The next pass should migrate Dashboard, Planner, Content, and Settings away from nested card-heavy layouts toward quiet lists and focused command strips.
- `tsconfig.tsbuildinfo` is an untracked generated file and should not be committed unless intentionally needed.
