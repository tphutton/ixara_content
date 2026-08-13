# Content Ops AI

Content Ops AI is an internal editorial operations workspace built with Next.js, Clerk, PostgreSQL, Prisma, and the OpenAI SDK. The app combines authentication, approvals, structured content management, scheduling, and AI-assisted workflows in a production-oriented admin UI.

## Current Status

Phase 1 foundation is in place:

- Next.js App Router scaffold
- Clerk provider and protected workspace routes
- Prisma schema drafted for all MVP models
- Initial dashboard shell and placeholder workspace pages
- Environment template and progress tracking

Phase 2 approvals is now in place:

- Clerk users are synced into `UserAccess` on authenticated requests
- Approved access is required for workspace routes
- `/pending-approval` reflects real pending/rejected state
- `/admin/approvals` supports role assignment plus approve/reject actions
- `INITIAL_ADMIN_EMAIL` bootstraps the first approved admin safely

Phase 3 CRUD is now in place:

- Prisma migration applied to PostgreSQL
- Real Content list/create/edit/delete flow
- Real Blog list/create/edit/delete flow
- Structured 8-block blog editor with preview
- Real Schedule list/create/edit/delete flow linked to Content and Blog records
- Manual mutation logging into `ContentActionLog`

Phase 4 assistant orchestration is now in place:

- Persisted chat threads and messages
- Server-side OpenAI tool calling
- Safe AI tools for content, blogs, schedules, and dashboard summaries
- Chat-side action summaries tied to real tool execution

Phase 5 dashboard visibility is now in place:

- Live content and blog status summaries
- Upcoming schedule visibility from Prisma
- Recent activity fed by `ContentActionLog`
- Quick links into the main editorial workflows

External campaigns integration is now in place:

- Server-side connection to the TechSport campaigns API
- Campaigns list/create/edit/delete inside the workspace
- Campaign visibility and mutation support in AI chat
- External API key stays server-side via env vars

Asset and brand operations are now in place:

- WordPress media sync into a local `Asset` catalog
- `/assets` workspace for syncing and browsing reusable media
- Linked asset selection in content, blog, and campaign forms
- Settings-based Brand Profile CRUD for shared editorial rules
- AI access to synced assets and brand profiles during chat workflows
- Brand-driven defaults for content and blogs so missing tone, audience, websites, geography, and CTA fields can inherit from saved profiles
- Dashboard readiness visibility for records that still need metadata before automation or publishing

Automation foundations are now in place:

- `/automations` workspace for creating and managing recurring workflows
- Workflow activation, pause, and manual run controls
- Execution history through `AutomationRun`
- Automation types: weekly social content generation into draft `Content` records, plus blog draft generation into structured `Blog` records
- Protected runner endpoint for due automations at `/api/automations/run-due`
- Dashboard and Quill visibility into automation health and upcoming runs

Content Command Platform expansion has started:

- `/planner` now acts as the command cockpit for campaign windows, schedule readiness, draft queues, asset availability, automation health, brand coverage, channel load, and performance signals
- The UI shell now follows the dark Ixara Command Center style and uses the full Ixara PNG logo on black
- Planner action cards now load strategic prompts into Quill, and Atlas can read planner intelligence from `/api/external/planner/summary`
- `/plans` now stores durable content plans and plan items so AI planning can move from idea to reviewable work
- Quill and Atlas can list content plans, create plans, and add plan items through the controlled tool layer
- AI quality reviews now score content, blogs, and plan items for brand fit, audience specificity, clarity, channel fit, conversion strength, and publishing risk
- Content/blog detail pages and plan items now have saved quality review actions, and Quill/Atlas can call `review_quality`
- Short-form content can apply saved quality recommendations through an audited AI rewrite, and schedule approvals now show quality warnings before queue approval
- Saved plan items can be promoted into content, blog, and schedule records from the UI or via Quill/Atlas
- Content, schedule, plan, and settings pages now use cleaner review-first layouts with long forms opened in modal overlays
- `/quality` now shows weak reviewed work, active items missing reviews, recent quality decisions, and is available to Quill/Atlas through `get_quality_summary`
- Sidebar navigation is grouped into Command, Creation, Operations, Intelligence, and Admin sections
- Brand Profiles now support richer AI context: positioning, content pillars, personas, offers, proof points, SEO keywords, competitors, voice examples, visual guidance, channel rules, and readiness scoring
- The UI simplification pass has started with the Plans workspace, quieter panels, flatter controls, and a narrower command sidebar
- The extended build plan is tracked in `CONTENT_COMMAND_PLATFORM_BUILD.md`
- The next planner layer is one-click AI plan generation, plan-item promotion into content/blog/schedule records, richer channel swimlanes, and gap heatmaps

Social publishing and analytics foundations are now being added:

- `/social-accounts` for registering future live publishing/analytics connections
- `/analytics` for storing imported post history and performance snapshots
- Quill tool access to connected accounts, published post history, and top-performing posts
- Internal schema support for future OAuth-based live sync, publishing history, and analytics ingestion

Legacy blog compatibility is now in place:

- `/api/blogs`
- `/api/blogs/by_brand?brand=...`
- `/api/blogs/[id]`
- Import script for the deprecated TechSport blogs source with legacy ID preservation

## Planned Stack

- Next.js 16
- React 19
- Clerk
- PostgreSQL
- Prisma ORM
- OpenAI Node SDK

## Getting Started

1. Copy `.env.example` to `.env`.
2. Fill in Clerk, PostgreSQL, and OpenAI credentials.
3. Install dependencies with `npm install`.
4. Generate the Prisma client with `npx prisma generate`.
5. Apply migrations with `npx prisma migrate dev`.
6. Set `INITIAL_ADMIN_EMAIL` to the email that should become the first approved admin.
7. Start the app with `npm run dev`.

Additional environment for campaigns:

- `CAMPAIGNS_API_BASE_URL`
- `CAMPAIGNS_API_KEY`
- `LEGACY_BLOGS_API_URL`
- `LEGACY_BLOGS_API_KEY`

Additional environment for assets:

- `WORDPRESS_MEDIA_BASE_URL` defaulting to `https://media.ixara.tech/wp-json/wp/v2`

## Environment Checklist

Local development:

- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_SIGN_IN_URL=/sign-in`
- `CLERK_SIGN_UP_URL=/sign-up`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5-mini`
- `INITIAL_ADMIN_EMAIL`
- `CAMPAIGNS_API_BASE_URL=https://data.techsport.asia/api`
- `CAMPAIGNS_API_KEY`
- `LEGACY_BLOGS_API_URL=https://data.techsport.asia/api/tables/blogs`
- `LEGACY_BLOGS_API_KEY`
- `WORDPRESS_MEDIA_BASE_URL=https://media.ixara.tech/wp-json/wp/v2`
- `AUTOMATION_RUNNER_SECRET`
- `META_APP_ID` for future live Meta OAuth
- `META_APP_SECRET` for future live Meta OAuth
- `META_SCOPES` optional override for Meta permissions
- `SOCIAL_ACCOUNT_ENCRYPTION_KEY` for encrypting stored social access tokens

Railway deployment:

- Add the same variables in the Railway service settings
- Set `NEXT_PUBLIC_APP_URL` to the final Railway app URL
- Keep `CAMPAIGNS_API_KEY`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, and `DATABASE_URL` server-side only
- Keep `AUTOMATION_RUNNER_SECRET` server-side only and use it for scheduled runner calls
- Keep `META_APP_SECRET` server-side only when live Meta OAuth is added
- Keep `SOCIAL_ACCOUNT_ENCRYPTION_KEY` server-side only because it protects stored platform tokens

## Clerk Setup

In Clerk, configure:

- Allowed redirect / origin for `http://localhost:3000`
- Allowed redirect / origin for the final Railway URL
- Sign-in path: `/sign-in`
- Sign-up path: `/sign-up`

The first user whose email matches `INITIAL_ADMIN_EMAIL` will be auto-approved as the initial admin.

## Railway Notes

- Provision PostgreSQL and set `DATABASE_URL`
- Redeploy after adding env vars
- Run Prisma migrations during setup or from your local environment against the Railway database
- Ensure the deployed app URL is also added back into Clerk

## Route Overview

- `/sign-in`
- `/sign-up`
- `/pending-approval`
- `/dashboard`
- `/planner`
- `/chat`
- `/assets`
- `/automations`
- `/campaigns`
- `/social-accounts`
- `/analytics`
- `/api/blogs`
- `/api/blogs/by_brand`
- `/api/blogs/[id]`
- `/api/external/planner/summary`
- `/content`
- `/blogs`
- `/schedule`
- `/admin/approvals`
- `/settings`

## Notes

- The assistant now has tool access to content, blogs, schedules, campaigns, synced assets, dashboard summaries, and brand profiles.
- Legacy blogs can be imported with `npm run import:legacy:blogs`, which upserts by preserved legacy IDs and keeps the compatibility API stable for older clients.
- WordPress remains the media origin while the local `Asset` table handles cataloging, search, and record relationships.
- Content and blog mutations now apply matching brand profile defaults server-side, and blogs now carry a dedicated `brand` field for consistent editorial grouping.
- Automation scheduling metadata and manual runs are now live, and workflows can generate either short-form content drafts or structured blog drafts. Background job execution is still the next planned step before social publishing.
- Quill can now inspect automation health, list workflows, and trigger safe automation runs through the same server-side tool layer used for content operations.
- The protected runner endpoint accepts either `Authorization: Bearer <AUTOMATION_RUNNER_SECRET>` or `x-automation-secret` and is designed for a future Railway cron or external scheduler.
- See `BUILD_PROGRESS.md` for milestone-by-milestone status.
