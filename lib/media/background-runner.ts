import { runDueMediaGenerationJobs } from "./runner";

type RunnerGlobal = typeof globalThis & { __ixaraMediaRunner?: NodeJS.Timeout };
export function startMediaRunner() {
  const state = globalThis as RunnerGlobal;
  if (state.__ixaraMediaRunner) return;
  let active = false;
  const tick = async () => {
    if (active || !process.env.RUNWAYML_API_SECRET) return;
    active = true;
    try { await runDueMediaGenerationJobs(5); }
    catch { console.error("Media runner failed; it will retry on the next tick."); }
    finally { active = false; }
  };
  state.__ixaraMediaRunner = setInterval(() => { void tick(); }, 30_000);
  state.__ixaraMediaRunner.unref();
  void tick();
}
