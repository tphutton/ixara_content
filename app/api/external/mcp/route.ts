import { handleMcp } from "@/lib/mcp/adapter";
import { respond } from "@/lib/mcp/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => respond(() => handleMcp(request));
export const POST = GET;
