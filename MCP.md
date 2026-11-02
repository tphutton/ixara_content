# Ixara Content MCP

Endpoint: `https://mcp.ixara.tech/mcp/ixara-content`. The existing webapp stays on Clerk. Auth0 protects this separate MCP resource; the MCP gateway verifies issuer, audience, client ID, owner subject and operation scopes. No external access token is forwarded to the webapp.

## Backend configuration

- `IXARA_MCP_ENABLED=true`
- `IXARA_MCP_ADMIN_KEY`: a new random secret of at least 32 characters, shared only with the matching MCP gateway's `IXARA_CONTENT_MCP_KEY`. Do not reuse `IXARA_EXTERNAL_API_KEY`.
- `IXARA_MCP_ACTOR_ID=chatgpt-content-owner`: distinct non-login technical actor; existing actor accounts are never elevated.
- `IXARA_MCP_WRITE_ENABLED=true`: enables database writes and editorial approval operations; false leaves reads available.

The gateway also needs `IXARA_CONTENT_MCP_ENABLED=true` and `IXARA_CONTENT_API_BASE_URL=https://content.ixara.tech`, plus the existing Auth0 issuer/client/owner configuration. Disable the new flags to withdraw this integration without affecting existing bot routes.

## Implemented boundary

Read content, blogs, schedules, assets, brands, campaigns, social account summaries, analytics, automations, plans, quality and production status. Save drafts, plan items, brand profiles, schedules, comments and storyboard edits. Request, decide and revoke editorial approvals through existing quality/readiness gates. Generic writes cannot mark records approved, ready, published or generating.

Campaign creation and partial updates use the existing TSADB campaigns table through its database-owned preview/apply API. Live publishing and provider synchronization remain outside this integration. Runway generation can be queued through the separately enabled production workflow described below. Existing Content action logs and saved change sets provide the local audit trail.

Every write uses `/api/external/mcp` preview/apply: preview executes original domain logic in a Serializable transaction and deliberately rolls it back. A durable 30-minute change set is saved separately. Apply rechecks scope and inputs, compares the saved record snapshot, and commits domain changes, audit rows and the saved result together. Advisory locking and the saved result prevent duplicate application. Preview-created IDs are not persistent IDs.

`lib/mcp/transaction.ts` uses AsyncLocalStorage to join nested existing services to the outer transaction. Requests outside this new context use the original Prisma client. Never add network/provider side effects to this transaction-based operation allowlist.

## Auth0 and installation

Create an Auth0 API with identifier exactly `https://mcp.ixara.tech/mcp/ixara-content`, RS256, scopes `ixara-content:read`, `ixara-content:write`, `ixara-content:approve`. Enable Resource Parameter Compatibility Profile and permit the existing client `HvSuYhJPY76c0wdThPgeSVwj51z5NGIL` to request those scopes under user-delegated access. Keep callback `https://chatgpt.com/connector_platform_oauth_redirect` and PKCE/public-client authentication method none. Do not change the Data API identifier or add these scopes to that API.

The `chatgpt-plugin/` package declares the provided public client and this resource. Install/connect once Auth0 is configured. Creating the plugin package alone does not prove live authentication or discovery.

## Validation

Run `npx prisma generate`, `npx tsc --noEmit`, `npm test`. `tests/mcp-postgres.integration.ts` must only run against a disposable database with this schema: it creates integration records. It verifies real Prisma nested rollback, audit rollback, apply retries, stale previews and approval guards. Never run it against production. The development verification used an ephemeral PGlite PostgreSQL wire-protocol database; multi-connection contention still needs a production-equivalent PostgreSQL integration environment.

## Campaign edits

`get_campaign` returns the current PostgreSQL edit version plus linked Content record IDs and campaign assets. `create_campaign` accepts `values` and defaults to draft. `update_campaign` requires `campaign_id`, `version` and `patch`; omitted fields and asset associations are preserved, and null clears nullable fields. Campaign renames report the name-based Content-link limitation rather than silently rewriting related records. No campaign deletions or automatic post publication are exposed.

Campaign previews do not call the legacy upsert and are never executed inside a local rollback. TSADB owns the validated preview, stale-version check, write, audit and retry result using its existing change-set tables. Content stores that provider preview within its own saved MCP change set. If a provider apply succeeds but the local Content audit transaction fails, applying the same saved preview again recovers the provider result without another campaign write, then commits the local audit/result. This is an idempotent cross-service recovery flow, not a distributed atomic transaction.

Enable `CAMPAIGNS_MCP_ENABLED=true` on TSADB. It uses the existing `CAMPAIGNS_API_BASE_URL` and `CAMPAIGNS_API_KEY` in Content; no new credential or campaign table is required. Read-only OAuth grants discover editing tools and receive an explicit `ixara-content:write` permission challenge before any write preview is forwarded. Existing approval operations still require their separate approval permission.

## Runway Dev production (draft)

The same queue serves the plan UI, Quill and MCP. Set an explicit per-plan credit reservation limit before queueing approved shots. Gen-4.5 supports 2–10 seconds and one first frame; Seedance Mini supports 4–15 seconds and up to four image references at 720p. Each image must be approved for the same brand and stored in private media. The system reads image bytes server-side and sends a data URI to Runway; it does not store the bytes or a public URL in the job. The estimates are 12 credits/second for Gen-4.5 and 15 credits/second for 720p Seedance Mini and must be rechecked against current provider prices. Reservations include failed and cancelled jobs and only cover jobs created by this workflow; they are not invoice data.

Set `RUNWAYML_API_SECRET` securely in the service. Set `RUNWAY_RUNNER_ENABLED=true` only after confirming billing and budgets. The Node background runner polls every 30 seconds. Queue previews never call Runway; once enabled, an applied queue action can incur charges asynchronously. Manual per-job start/check is available. Multiple workers claim a queued job atomically; an ambiguous submission is held, not retried. A user-verified provider task ID can be attached after two minutes without submitting a replacement. Provider results are copied to private storage; temporary storage failures retry without creating another generation.

This initial workflow supports either one first frame or up to four image references; it does not assemble a complete video. Live paid tests, production-equivalent concurrent database tests, and end-to-end tool discovery in the connected ChatGPT client remain required.
