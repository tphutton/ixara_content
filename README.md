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
- First automation type: weekly social content generation into draft `Content` records
- Protected runner endpoint for due automations at `/api/automations/run-due`
- Dashboard and Quill visibility into automation health and upcoming runs

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
- `WORDPRESS_MEDIA_BASE_URL=https://media.ixara.tech/wp-json/wp/v2`
- `AUTOMATION_RUNNER_SECRET`

Railway deployment:

- Add the same variables in the Railway service settings
- Set `NEXT_PUBLIC_APP_URL` to the final Railway app URL
- Keep `CAMPAIGNS_API_KEY`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, and `DATABASE_URL` server-side only
- Keep `AUTOMATION_RUNNER_SECRET` server-side only and use it for scheduled runner calls

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
- `/chat`
- `/assets`
- `/automations`
- `/campaigns`
- `/content`
- `/blogs`
- `/schedule`
- `/admin/approvals`
- `/settings`

## Notes

- The assistant now has tool access to content, blogs, schedules, campaigns, synced assets, dashboard summaries, and brand profiles.
- WordPress remains the media origin while the local `Asset` table handles cataloging, search, and record relationships.
- Content and blog mutations now apply matching brand profile defaults server-side, and blogs now carry a dedicated `brand` field for consistent editorial grouping.
- Automation scheduling metadata and manual runs are now live, but background job execution is still the next planned step before social publishing.
- Quill can now inspect automation health, list workflows, and trigger safe automation runs through the same server-side tool layer used for content operations.
- The protected runner endpoint accepts either `Authorization: Bearer <AUTOMATION_RUNNER_SECRET>` or `x-automation-secret` and is designed for a future Railway cron or external scheduler.
- See `BUILD_PROGRESS.md` for milestone-by-milestone status.
