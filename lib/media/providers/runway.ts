type RunwayInput = {
  prompt: string;
  promptImage?: string | null;
  referenceImages?: string[];
  model?: "gen4.5" | "seedance2_mini";
  durationSeconds: number;
  aspectRatio: string;
};

type RunwayTask = {
  id: string;
  status?: string;
  output?: string[];
  failure?: string;
  failureCode?: string;
};

const runwayBaseUrl = "https://api.dev.runwayml.com";

function getSecret() {
  const secret = process.env.RUNWAYML_API_SECRET;
  if (!secret) throw new Error("RUNWAYML_API_SECRET is not configured.");
  return secret;
}

function runwayRatio(aspectRatio: string) {
  const ratios: Record<string, string> = {
    "9:16": "720:1280",
    "16:9": "1280:720",
    "1:1": "960:960",
    "4:3": "1104:832",
    "3:4": "832:1104",
    "21:9": "1584:672",
  };
  const ratio = ratios[aspectRatio] ?? aspectRatio;
  if (!["1280:720", "720:1280", "960:960", "1104:832", "832:1104", "1584:672"].includes(ratio)) throw new Error("Unsupported Gen-4.5 aspect ratio.");
  return ratio;
}

async function runwayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${runwayBaseUrl}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${getSecret()}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `Runway request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export async function startRunwayVideo(input: RunwayInput) {
  const model = input.model ?? "gen4.5";
  if (model !== "gen4.5" && model !== "seedance2_mini") throw new Error("Unsupported model.");
  const min = model === "gen4.5" ? 2 : 4;
  const max = model === "gen4.5" ? 10 : 15;
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < min || input.durationSeconds > max) throw new Error(`${model} supports ${min}–${max} seconds per shot; split longer videos into shots.`);
  if (!input.prompt.trim() || input.prompt.length > 1000) throw new Error("Prompt must contain 1–1000 characters.");
  const images = input.referenceImages ?? (input.promptImage ? [input.promptImage] : []);
  if (!images.length || images.length > 4 || (model === "gen4.5" && images.length !== 1)) throw new Error("A valid first-frame or reference image is required.");
  const ratio = runwayRatio(input.aspectRatio);
  if (model === "seedance2_mini" && !["1280:720", "720:1280", "960:960"].includes(ratio)) throw new Error("Unsupported Seedance Mini aspect ratio.");
  return runwayRequest<RunwayTask>("/v1/image_to_video", {
    method: "POST",
    body: JSON.stringify({
      model,
      promptText: input.prompt,
      promptImage: model === "gen4.5" ? images[0] : images.map(uri => ({ uri })),
      ratio,
      duration: input.durationSeconds,
      ...(model === "seedance2_mini" ? { audio: false } : {}),
    }),
  });
}

export async function getRunwayTask(taskId: string) {
  return runwayRequest<RunwayTask>(`/v1/tasks/${encodeURIComponent(taskId)}`);
}
