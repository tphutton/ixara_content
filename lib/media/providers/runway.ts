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
    "1:1": "1024:1024",
    "4:5": "1024:1280",
    "4:3": "1120:832",
  };
  return ratios[aspectRatio] ?? aspectRatio;
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
  return runwayRequest<RunwayTask>("/v1/image_to_video", {
    method: "POST",
    body: JSON.stringify({
      model: "gen4.5",
      promptText: input.prompt,
      promptImage: input.promptImage || undefined,
      ratio: runwayRatio(input.aspectRatio),
      duration: Math.min(Math.max(Math.round(input.durationSeconds), 2), 10),
    }),
  });
}

export async function getRunwayTask(taskId: string) {
  return runwayRequest<RunwayTask>(`/v1/tasks/${encodeURIComponent(taskId)}`);
}
