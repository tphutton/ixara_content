import { NextResponse } from "next/server";
import { runDueAutomations } from "@/lib/automation/runner";

function isAuthorized(request: Request) {
  const secret = process.env.AUTOMATION_RUNNER_SECRET;

  if (!secret) {
    return false;
  }

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-automation-secret");

  return bearer === `Bearer ${secret}` || headerSecret === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueAutomations();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Automation runner failed.",
      },
      { status: 500 },
    );
  }
}
