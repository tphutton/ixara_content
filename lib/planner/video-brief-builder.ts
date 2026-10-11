import { ContentPlanItemType, VideoBriefStatus, type UserAccess } from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { getOpenAIClient } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const VIDEO_MODEL = process.env.OPENAI_VIDEO_PLANNER_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";

type VideoBriefInput = {
  planItemId: string;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  targetPlatforms?: string[];
  guidance?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function duration(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 45;
  return Math.min(Math.max(Math.round(value), 5), 120);
}

function shotCount(total: number) {
  return total <= 15 ? 3 : Math.ceil(total / 5);
}

export async function generateVideoBrief(access: UserAccess, input: VideoBriefInput) {
  const item = await prisma.contentPlanItem.findUniqueOrThrow({
    where: { id: input.planItemId },
    include: {
      plan: true,
      videoBrief: { include: { shots: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  if (item.itemType !== ContentPlanItemType.video) {
    throw new Error("Video briefs can only be generated for video plan items.");
  }

  const totalDuration = duration(input.durationSeconds ?? item.videoBrief?.durationSeconds);
  const platforms = input.targetPlatforms?.filter(Boolean) ?? (item.channel ? [item.channel] : ["Instagram Reels", "TikTok"]);
  const response = await getOpenAIClient().chat.completions.create({
    model: VIDEO_MODEL,
    messages: [{
      role: "user",
      content: `
You are Ixara's senior short-form video producer. Build a production-ready storyboard for this approved planning context.

Return only valid JSON with:
concept, script, voiceover, onScreenText, audioDirection, visualDirection, generationStrategy, shots.

The video duration is exactly ${totalDuration} seconds. Use ${shotCount(totalDuration)} storyboard shots, each with title, durationSeconds, purpose, prompt, cameraDirection, visualDetails, onScreenText, voiceover. Shot durations must add up exactly to ${totalDuration} seconds.
Make each shot specific: subject, action, environment, lighting, camera movement, composition, and continuity. Avoid generic marketing language.
For videos longer than 15 seconds, generationStrategy must explain how the storyboard will be split into Runway segments of no more than 15 seconds and assembled afterward.
Platforms: ${platforms.join(", ")}.
Aspect ratio: ${clean(input.aspectRatio) ?? "9:16"}.
Brand: ${item.brand ?? item.plan.brand ?? "not specified"}.
Campaign: ${item.campaignName ?? item.plan.campaignName ?? "not specified"}.
Objective: ${item.objective ?? item.plan.goal ?? "not specified"}.
Audience: ${item.targetAudience ?? "not specified"}.
Key message: ${item.keyMessage ?? "not specified"}.
CTA: ${item.callToAction ?? "not specified"}.
Tone: ${item.tone ?? "not specified"}.
Brief: ${item.brief ?? "not specified"}.
Asset direction: ${item.assetRequest ?? "not specified"}.
Operator guidance: ${clean(input.guidance) ?? "Use the strongest brand-safe interpretation."}.
      `.trim(),
    }],
    response_format: { type: "json_object" },
  });

  const raw = JSON.parse(response.choices[0]?.message.content ?? "{}");
  const shots = Array.isArray(raw.shots) ? raw.shots : [];
  const normalizedShots = shots.map((shot: Record<string, unknown>, index: number) => ({
    sortOrder: index,
    title: clean(shot.title) ?? `Shot ${index + 1}`,
    durationSeconds: Math.max(1, Math.round(Number(shot.durationSeconds) || 5)),
    purpose: clean(shot.purpose),
    prompt: clean(shot.prompt) ?? "Define the subject, action, environment, camera movement, and continuity.",
    cameraDirection: clean(shot.cameraDirection),
    visualDetails: clean(shot.visualDetails),
    onScreenText: clean(shot.onScreenText),
    voiceover: clean(shot.voiceover),
    status: "planned" as const,
  }));
  const difference = totalDuration - normalizedShots.reduce((sum: number, shot: { durationSeconds: number }) => sum + shot.durationSeconds, 0);
  if (normalizedShots.length > 0 && difference !== 0) {
    normalizedShots[normalizedShots.length - 1].durationSeconds = Math.max(1, normalizedShots[normalizedShots.length - 1].durationSeconds + difference);
  }

  const brief = await prisma.videoBrief.upsert({
    where: { planItemId: item.id },
    create: {
      planItemId: item.id,
      durationSeconds: totalDuration,
      aspectRatio: clean(input.aspectRatio) ?? "9:16",
      targetPlatforms: platforms,
      concept: clean(raw.concept) ?? item.brief ?? item.title,
      script: clean(raw.script),
      voiceover: clean(raw.voiceover),
      onScreenText: clean(raw.onScreenText),
      audioDirection: clean(raw.audioDirection),
      visualDirection: clean(raw.visualDirection),
      generationStrategy: clean(raw.generationStrategy),
      status: VideoBriefStatus.review,
      createdById: access.id,
      updatedById: access.id,
      shots: { create: normalizedShots },
    },
    update: {
      durationSeconds: totalDuration,
      aspectRatio: clean(input.aspectRatio) ?? "9:16",
      targetPlatforms: platforms,
      concept: clean(raw.concept) ?? item.brief ?? item.title,
      script: clean(raw.script),
      voiceover: clean(raw.voiceover),
      onScreenText: clean(raw.onScreenText),
      audioDirection: clean(raw.audioDirection),
      visualDirection: clean(raw.visualDirection),
      generationStrategy: clean(raw.generationStrategy),
      status: VideoBriefStatus.review,
      updatedById: access.id,
      shots: {
        deleteMany: {},
        create: normalizedShots,
      },
    },
    include: { shots: { orderBy: { sortOrder: "asc" } } },
  });

  await createActionLog({
    userId: access.id,
    actionType: "generate",
    targetType: "video_brief",
    targetId: brief.id,
    summary: `Generated a ${totalDuration}-second video storyboard for "${item.title}"`,
    afterData: brief,
    source: "ai",
  });

  return brief;
}
