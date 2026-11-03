import { runDueMediaGenerationJobs } from "./runner";
import { runDueAudioInspections } from "./audio-inspection-runner";
import { runDueVideoAssemblies } from "./assembly-runner";
import { runDueVideoInspections } from "./video-inspection-runner";

type RunnerGlobal = typeof globalThis & { __ixaraMediaRunner?: NodeJS.Timeout };
export function startMediaRunner() {
  const state = globalThis as RunnerGlobal;
  if (state.__ixaraMediaRunner) return;
  let active = false;
  const tick = async () => {
    if (active) return;
    active = true;
    try { if (process.env.RUNWAYML_API_SECRET) await runDueMediaGenerationJobs(5); await runDueAudioInspections(); await runDueVideoAssemblies(); await runDueVideoInspections(); }
    catch { console.error("Media runner failed; it will retry on the next tick."); }
    finally { active = false; }
  };
  state.__ixaraMediaRunner = setInterval(() => { void tick(); }, 30_000);
  state.__ixaraMediaRunner.unref();
  void tick();
}
