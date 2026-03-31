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

## In Progress
- [ ] Begin Phase 6 cleanup, setup documentation, and deployment readiness polish.

## Pending
- [ ] Document setup, local development, and deployment flow.

## Database Schema Summary
- `UserAccess` for Clerk-linked internal roles and approval status.
- `Content` for short-form editorial and campaign content records.
- `Blog` for structured 8-block article records.
- `ContentSchedule` for scheduling content and blog publishing operations.
- `ChatThread` and `ChatMessage` for assistant conversations and tool traces.
- `ContentActionLog` for mutation audit history.
- `BrandProfile` for editorial guidance and AI consistency controls.

## Pages / Routes
- `/`
- `/sign-in`
- `/sign-up`
- `/pending-approval`
- `/api/chat`
- `/dashboard`
- `/chat`
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

## Known Issues / Notes
- Workspace approval enforcement is active for protected routes and the chat API.
- The admin approvals page requires an approved admin account; set `INITIAL_ADMIN_EMAIL` before first sign-in to bootstrap the first admin safely.
- Dashboard and chat are both now backed by live Prisma data and server-side actions.
- Chat is now live with persisted threads and server-side tool execution.
- Content, blogs, and schedule are now Prisma-backed and require live database connectivity at runtime.
- Prisma is pinned to `6.14.x` because the local Node runtime is `20.18.2`, while Prisma `7.x` requires Node `20.19+`.
- Next.js verification is running with `--webpack` in this environment because Turbopack build panicked under sandbox port restrictions.

## Next Steps
- Replace dashboard placeholder metrics with Prisma summaries and recent action log data.
- Improve chat UX with richer tool result rendering and better error surfacing.
- Document production environment setup for Clerk, OpenAI, and Railway.
