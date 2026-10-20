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

External campaign changes, live publishing, provider synchronization, paid AI/media generation and Command Center artifact delivery are not implemented in this version. Existing Content action logs and saved change sets provide the local audit trail.

Every write uses `/api/external/mcp` preview/apply: preview executes original domain logic in a Serializable transaction and deliberately rolls it back. A durable 30-minute change set is saved separately. Apply rechecks scope and inputs, compares the saved record snapshot, and commits domain changes, audit rows and the saved result together. Advisory locking and the saved result prevent duplicate application. Preview-created IDs are not persistent IDs.

`lib/mcp/transaction.ts` uses AsyncLocalStorage to join nested existing services to the outer transaction. Requests outside this new context use the original Prisma client. Never add network/provider side effects to this transaction-based operation allowlist.

## Auth0 and installation

Create an Auth0 API with identifier exactly `https://mcp.ixara.tech/mcp/ixara-content`, RS256, scopes `ixara-content:read`, `ixara-content:write`, `ixara-content:approve`. Enable Resource Parameter Compatibility Profile and permit the existing client `HvSuYhJPY76c0wdThPgeSVwj51z5NGIL` to request those scopes under user-delegated access. Keep callback `https://chatgpt.com/connector_platform_oauth_redirect` and PKCE/public-client authentication method none. Do not change the Data API identifier or add these scopes to that API.

The `chatgpt-plugin/` package declares the provided public client and this resource. Install/connect once Auth0 is configured. Creating the plugin package alone does not prove live authentication or discovery.

## Validation

Run `npx prisma generate`, `npx tsc --noEmit`, `npm test`. `tests/mcp-postgres.integration.ts` must only run against a disposable database with this schema: it creates integration records. It verifies real Prisma nested rollback, audit rollback, apply retries, stale previews and approval guards. Never run it against production. The development verification used an ephemeral PGlite PostgreSQL wire-protocol database; multi-connection contention still needs a production-equivalent PostgreSQL integration environment.
