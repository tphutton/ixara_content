/** Railway Node runtime: process persisted media jobs when explicitly enabled. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.RUNWAY_RUNNER_ENABLED !== "true") return;
  const { startMediaRunner } = await import("@/lib/media/background-runner");
  startMediaRunner();
}
