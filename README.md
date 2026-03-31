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
5. Set `INITIAL_ADMIN_EMAIL` to the email that should become the first approved admin.
6. Start the app with `npm run dev`.

## Route Overview

- `/sign-in`
- `/sign-up`
- `/pending-approval`
- `/dashboard`
- `/chat`
- `/content`
- `/blogs`
- `/schedule`
- `/admin/approvals`
- `/settings`

## Notes

- CRUD flows for content, blogs, and scheduling are the next major milestone.
- See `BUILD_PROGRESS.md` for milestone-by-milestone status.
