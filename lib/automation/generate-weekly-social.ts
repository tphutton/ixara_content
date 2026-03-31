import { ContentStatus, ContentType, type AutomationWorkflow, type BrandProfile, type UserAccess } from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { getOpenAIClient } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { calculateNextAutomationRun } from "@/lib/automation/schedule";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";

type GeneratedItem = {
  title: string;
  hook?: string;
  body?: string;
  cta?: string;
  platform?: string;
  tags?: string[];
  targetAudience?: string;
  tone?: string;
};

function buildPrompt(workflow: AutomationWorkflow, profile: BrandProfile | null) {
  return `
You are generating weekly social content drafts for an internal editorial automation.

Return valid JSON in this shape only:
{
  "items": [
    {
      "title": "string",
      "hook": "string",
      "body": "string",
      "cta": "string",
      "platform": "string",
      "tags": ["string"],
      "targetAudience": "string",
      "tone": "string"
    }
  ]
}

Rules:
- Create exactly ${workflow.itemCount} items.
- Keep content concise, operational, and ready to edit.
- Do not invent URLs or external facts.
- Focus on social-first short-form content.
- Vary hooks and angles across the set.

Workflow:
- Name: ${workflow.name}
- Brand: ${workflow.brandName ?? profile?.brandName ?? "Not specified"}
- Description: ${workflow.description ?? "None"}
- Prompt template: ${workflow.promptTemplate ?? "None"}
- Platforms: ${workflow.platforms.join(", ") || "Not specified"}
- Channels: ${workflow.channels.join(", ") || "Not specified"}
- Region: ${workflow.region ?? "Not specified"}
- Country: ${workflow.country ?? "Not specified"}
- Sport: ${workflow.sport ?? "Not specified"}
- Target content status: ${workflow.targetContentStatus}

Brand profile guidance:
- Tone: ${profile?.defaultTone ?? "Not specified"}
- Audience: ${profile?.targetAudience ?? "Not specified"}
- Preferred websites: ${profile?.preferredWebsites.join(", ") || "None"}
- Preferred CTAs: ${profile?.preferredCTAs.join(", ") || "None"}
- Banned phrases: ${profile?.bannedPhrases.join(", ") || "None"}
`.trim();
}

function parseGeneratedItems(content: string) {
  const parsed = JSON.parse(content) as { items?: GeneratedItem[] };

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Automation response did not include any items.");
  }

  return parsed.items;
}

export async function runWeeklySocialAutomation(input: {
  workflow: AutomationWorkflow;
  triggeredBy: UserAccess;
}) {
  const workflow = input.workflow;
  const profile = workflow.brandProfileId
    ? await prisma.brandProfile.findUnique({ where: { id: workflow.brandProfileId } })
    : workflow.brandName
      ? await prisma.brandProfile.findFirst({
          where: { brandName: { equals: workflow.brandName, mode: "insensitive" } },
        })
      : null;

  const run = await prisma.automationRun.create({
    data: {
      workflowId: workflow.id,
      status: "running",
      triggeredById: input.triggeredBy.id,
      summary: `Running ${workflow.name}`,
    },
  });

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You generate structured JSON for editorial automations.",
        },
        {
          role: "user",
          content: buildPrompt(workflow, profile),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned no automation content.");
    }

    const items = parseGeneratedItems(content);

    const createdContent = await Promise.all(
      items.slice(0, workflow.itemCount).map((item) =>
        prisma.content.create({
          data: {
            title: item.title,
            hook: item.hook ?? null,
            body: item.body ?? null,
            cta: item.cta ?? profile?.preferredCTAs[0] ?? null,
            contentType: ContentType.social_post,
            platform: item.platform ?? workflow.platforms[0] ?? null,
            status: workflow.targetContentStatus ?? ContentStatus.draft,
            campaignName: workflow.name,
            brand: workflow.brandName ?? profile?.brandName ?? null,
            sport: workflow.sport ?? (profile?.sports.length === 1 ? profile.sports[0] : null),
            region: workflow.region ?? (profile?.regions.length === 1 ? profile.regions[0] : null),
            country:
              workflow.country ?? (profile?.countries.length === 1 ? profile.countries[0] : null),
            tags: item.tags ?? [],
            targetAudience: item.targetAudience ?? profile?.targetAudience ?? null,
            tone: item.tone ?? profile?.defaultTone ?? null,
            websites: profile?.preferredWebsites ?? [],
            aiGenerated: true,
            sourcePrompt: workflow.promptTemplate ?? workflow.description ?? workflow.name,
            createdById: input.triggeredBy.id,
            updatedById: input.triggeredBy.id,
          },
        }),
      ),
    );

    const nextRunAt = calculateNextAutomationRun({
      frequency: workflow.frequency,
      dayOfWeek: workflow.dayOfWeek,
      runTime: workflow.runTime,
      timezone: workflow.timezone,
      from: new Date(),
    });

    await prisma.automationWorkflow.update({
      where: { id: workflow.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: "succeeded",
        summary: `Created ${createdContent.length} content draft${createdContent.length === 1 ? "" : "s"}`,
        output: {
          contentIds: createdContent.map((item) => item.id),
          titles: createdContent.map((item) => item.title),
        },
        completedAt: new Date(),
      },
    });

    await createActionLog({
      userId: input.triggeredBy.id,
      actionType: "run",
      targetType: "automation",
      targetId: workflow.id,
      summary: `Ran automation "${workflow.name}" and created ${createdContent.length} content draft${createdContent.length === 1 ? "" : "s"}`,
      afterData: {
        runId: run.id,
        contentIds: createdContent.map((item) => item.id),
      },
      source: "automation",
    });

    return {
      runId: run.id,
      createdContent,
    };
  } catch (error) {
    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Automation failed.",
        completedAt: new Date(),
      },
    });

    throw error;
  }
}
