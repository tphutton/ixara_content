type RunwayInput = {
  prompt: string;
  promptImage?: string | null;
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
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 2 || input.durationSeconds > 10) {
    throw new Error("Gen-4.5 supports 2–10 seconds per shot; split longer videos into shots.");
  }
  if (!input.prompt.trim() || input.prompt.length > 1000) throw new Error("Prompt must contain 1–1000 characters.");
  if (!input.promptImage) throw new Error("A first-frame image is required for image-to-video generation.");
  return runwayRequest<RunwayTask>("/v1/image_to_video", {
    method: "POST",
    body: JSON.stringify({
      model: "gen4.5",
      promptText: input.prompt,
      promptImage: input.promptImage || undefined,
      ratio: runwayRatio(input.aspectRatio),
      duration: input.durationSeconds,
    }),
  });
}

export async function getRunwayTask(taskId: string) {
  return runwayRequest<RunwayTask>(`/v1/tasks/${encodeURIComponent(taskId)}`);
}
