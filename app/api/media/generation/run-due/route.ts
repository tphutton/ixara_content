import { NextResponse } from "next/server";
import { runDueMediaGenerationJobs } from "@/lib/media/runner";

function isAuthorized(request: Request) {
  const secret = process.env.AUTOMATION_RUNNER_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-automation-secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { limit?: unknown };
    const result = await runDueMediaGenerationJobs(typeof body.limit === "number" ? body.limit : 5);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Media generation runner failed." }, { status: 500 });
  }
}
