# Build Progress

## Project Overview
Production-ready internal web application for AI-assisted content operations, built with Next.js App Router, Clerk authentication, PostgreSQL, Prisma, and the OpenAI SDK.

## Architecture Decisions
- Next.js App Router with route groups for public auth pages and protected workspace pages.
- Clerk manages identity; PostgreSQL stores internal access and approval metadata through `UserAccess`.
- Prisma is the single source of truth for application data models and relational integrity.
- AI actions will be executed server-side through a controlled tool layer and persisted in chat/action log tables.
- Approval state is enforced in the protected app layout; unapproved users are redirected to `/pending-approval`.
- The initial admin bootstrap path is controlled by `INITIAL_ADMIN_EMAIL`, which auto-approves that address on first sync.
- Prisma migrations are applied against PostgreSQL, and all database-backed workspace pages are marked dynamic to avoid build-time DB coupling.
- The AI chat layer uses server-side OpenAI tool calling with persisted threads/messages and explicit database-safe tools.
- The dashboard now uses live Prisma summaries and recent `ContentActionLog` activity instead of placeholder metrics.
- External campaigns are integrated through the TechSport campaigns API and exposed in both the workspace UI and the AI tool layer.
- Campaign API access now degrades gracefully in the dashboard, campaigns workspace, and chat tool flow when config or upstream availability fails.
- WordPress media is now synced into a local `Asset` catalog so content, blogs, campaigns, and chat can reuse the same media records.
- Brand profiles are now managed inside Settings and injected into the AI chat context to keep editorial output aligned with shared rules.
- Brand profiles now actively shape content and blog workflows through server-side default inheritance, blog-level brand metadata, and readiness guidance in the editor UI and dashboard.
- Schedule oversight now includes readiness evaluation, approval queues, and editor-driven approval actions so the calendar can feed future automation safely.
- Content and blog list pages now expose lightweight operational queues so the team can quickly isolate automation-ready versus needs-attention records without introducing a heavy reporting layer.
- The chat workspace has been redesigned into a more production-ready Quill operator console with a stronger split layout for conversation, threads, and tool activity.
- A first automation foundation is now in place with controllable workflow records, manual execution, run history, and weekly social content generation into draft content records.
- Automation health, due-run execution, and AI-side automation controls are now visible in the workspace so operators can monitor and trigger workflows safely before full background scheduling.
- Core operational pages now include stronger summary surfaces, active filter states, and a schedule calendar that blends scheduled content with campaigns for real planning visibility.

## Completed
- [x] Created root project scaffold and TypeScript/Next.js config.
- [x] Added environment template, lint config, and ignore rules.
- [x] Drafted full Prisma schema for auth, content, blogs, scheduling, chat, and audit logging.
- [x] Built the initial app shell, route structure, and Clerk-protected workspace layout.
- [x] Installed dependencies, generated Prisma client, and aligned the scaffold with Next.js 16 conventions.
- [x] Added the initial server-side OpenAI foundation files (`lib/openai.ts`, `app/api/chat/route.ts`).
- [x] Implemented Clerk-to-PostgreSQL user sync on authenticated requests.
- [x] Enforced approval-gated workspace access and a dynamic pending/rejected approval page.
- [x] Built the first admin approvals workflow with role assignment and approve/reject actions.
- [x] Applied the initial Prisma migration to PostgreSQL and committed the generated migration files.
- [x] Replaced placeholder Content pages with Prisma-backed listing, create, edit, and delete flows.
- [x] Built the structured Blog CRUD workflow with an 8-section editor and side-by-side preview.
- [x] Replaced placeholder Schedule pages with Prisma-backed listing, create, edit, and delete flows linked to Content and Blog records.
- [x] Added action logging for manual content, blog, and schedule mutations.
- [x] Built persisted chat threads and messages in the `/chat` workspace.
- [x] Implemented server-side OpenAI tool orchestration for listing and mutating content, blogs, schedules, and dashboard summaries.
- [x] Added chat-side action summaries tied to actual tool results.
- [x] Replaced dashboard placeholder cards and activity with live counts, schedule visibility, quick links, and action-log-driven recent activity.
- [x] Integrated the external TechSport campaigns API with server-side auth, workspace CRUD, and AI access.
- [x] Added production-readiness polish for campaign API resilience, chat tool feedback, and environment/setup documentation.
- [x] Added a synced WordPress-backed asset library plus asset linking in content, blog, and campaign workflows.
- [x] Replaced the placeholder Settings page with live Brand Profile CRUD for shared editorial guidance.
- [x] Extended AI chat with asset sync/search tools and brand profile context/tool access.
- [x] Added brand-aware defaults and warnings for content/blog creation, including a new `Blog.brand` field and dashboard publishing-readiness visibility.
- [x] Added schedule queue filters, readiness evaluation, and approval actions for editor/admin review workflows.
- [x] Added lightweight queue filtering for content and blog readiness, keeping editorial oversight practical ahead of automation work.
- [x] Refreshed the chat workspace UI with Quill branding, avatar support, and a cleaner split-panel layout.
- [x] Added the first automation workspace with workflow CRUD, run history, activation controls, and weekly social draft generation.
- [x] Added automation runner controls, health summaries, dashboard visibility, and safe automation tools for Quill.
- [x] Polished core list pages with summary cards, clearer controls, and a shared planning calendar for schedule plus campaigns.

## In Progress
- [ ] Continue production polish, UX refinement, and rollout preparation.

## Pending
- [ ] Add platform publishing workflows and social-channel delivery.
- [ ] Expand asset relationships into section-level blog media slots and publishing-ready variants.

## Database Schema Summary
- `UserAccess` for Clerk-linked internal roles and approval status.
- `Content` for short-form editorial and campaign content records.
- `Blog` for structured 8-block article records.
- `ContentSchedule` for scheduling content and blog publishing operations.
- `ContentSchedule.approvedById` is now active as part of the review and readiness workflow for future automation/publishing.
- `ChatThread` and `ChatMessage` for assistant conversations and tool traces.
- `ContentActionLog` for mutation audit history.
- `BrandProfile` for editorial guidance and AI consistency controls.
- `Asset`, `ContentAsset`, `BlogAsset`, and `CampaignAsset` for reusable media management and relationship tracking.
- `Blog.brand` now links blog records into the same brand-rule system used by content, campaigns, and schedule metadata.
- `AutomationWorkflow` and `AutomationRun` now provide the basis for controlled recurring content generation and future scheduler execution.

## Pages / Routes
- `/`
- `/sign-in`
- `/sign-up`
- `/pending-approval`
- `/api/chat`
- `/dashboard`
- `/chat`
- `/assets`
- `/campaigns`
- `/campaigns/new`
- `/campaigns/[id]`
- `/content`
- `/content/new`
- `/content/[id]`
- `/blogs`
- `/blogs/new`
- `/blogs/[id]`
- `/schedule`
- `/schedule/new`
- `/schedule/[id]`
- `/admin/approvals`
- `/settings`
- `/automations`
- `/automations/new`
- `/automations/[id]`
- `/api/automations/run-due`

## Known Issues / Notes
- Workspace approval enforcement is active for protected routes and the chat API.
- The admin approvals page requires an approved admin account; set `INITIAL_ADMIN_EMAIL` before first sign-in to bootstrap the first admin safely.
- Dashboard and chat are both now backed by live Prisma data and server-side actions.
- Chat is now live with persisted threads and server-side tool execution.
- Content, blogs, and schedule are now Prisma-backed and require live database connectivity at runtime.
- Campaigns are served from the external TechSport campaigns API and require `CAMPAIGNS_API_KEY`.
- Campaign create/update/delete still depend on the upstream API being reachable at request time, but list/dashboard/chat now fail more gracefully.
- WordPress media sync uses the public REST API and defaults to `https://media.ixara.tech/wp-json/wp/v2` unless `WORDPRESS_MEDIA_BASE_URL` is set.
- Content and blog actions now auto-fill missing metadata from matching brand profiles and record brand-rule warnings in the action log.
- Schedule pages now expose queue-style filtering for all, ready, needs-attention, approved, and this-week views.
- Content and blog pages now expose queue-style filtering for automation-ready and needs-attention views.
- `/automations` now supports workflow setup, manual execution, activation/pausing, due-run checks, and run logs. Scheduling metadata and a protected runner endpoint are stored now; background execution wiring is the next phase.
- `/schedule` now supports both table and calendar views, with campaign windows layered into the same monthly planning surface as scheduled content and blog items.
- Prisma is pinned to `6.14.x` because the local Node runtime is `20.18.2`, while Prisma `7.x` requires Node `20.19+`.
- Next.js verification is running with `--webpack` in this environment because Turbopack build panicked under sandbox port restrictions.

## Next Steps
- Finalize deployment envs in Railway, Clerk, OpenAI, campaigns API, and WordPress sync.
- Connect the protected automation runner to a real scheduled trigger in Railway or another job system.
- Add the next automation layer: more workflow types beyond weekly social content, plus deeper safety controls and operator reporting.
- Add bulk actions, notifications, and approval inbox patterns so operators can move faster once automation volume increases.
- Add social publishing architecture after automation is designed.
