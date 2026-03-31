import {
  BlogStatus,
  type AutomationWorkflow,
  type BrandProfile,
  type UserAccess,
} from "@prisma/client";
import { createActionLog } from "@/lib/actions/action-log";
import { calculateNextAutomationRun } from "@/lib/automation/schedule";
import { applyBrandRulesToBlog } from "@/lib/brand-profiles/rules";
import { getOpenAIClient } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";

type GeneratedBlogItem = {
  title: string;
  category?: string;
  authorName?: string;
  authorBio?: string;
  tags?: string[];
  sources?: string[];
  text1?: string;
  text2?: string;
  text3?: string;
  text4?: string;
  text5?: string;
  text6?: string;
  text7?: string;
  text8?: string;
  image1Caption?: string;
  image2Caption?: string;
  image3Caption?: string;
  image4Caption?: string;
  image5Caption?: string;
  image6Caption?: string;
  image7Caption?: string;
  image8Caption?: string;
};

function buildPrompt(workflow: AutomationWorkflow, profile: BrandProfile | null) {
  return `
You are generating structured blog draft records for an internal editorial automation.

Return valid JSON in this shape only:
{
  "items": [
    {
      "title": "string",
      "category": "string",
      "authorName": "string",
      "authorBio": "string",
      "tags": ["string"],
      "sources": ["string"],
      "text1": "string",
      "text2": "string",
      "text3": "string",
      "text4": "string",
      "text5": "string",
      "text6": "string",
      "text7": "string",
      "text8": "string",
      "image1Caption": "string",
      "image2Caption": "string",
      "image3Caption": "string",
      "image4Caption": "string",
      "image5Caption": "string",
      "image6Caption": "string",
      "image7Caption": "string",
      "image8Caption": "string"
    }
  ]
}

Rules:
- Create exactly ${workflow.itemCount} blog drafts.
- Write publication-friendly sections that fit the structured 8-block blog model.
- Do not invent URLs, statistics, or source links.
- If a source is not explicitly known, leave the sources array empty.
- If later sections are not needed, return them as empty strings.
- Image captions may be provided when useful, but do not invent image URLs.

Workflow:
- Name: ${workflow.name}
- Brand: ${workflow.brandName ?? profile?.brandName ?? "Not specified"}
- Description: ${workflow.description ?? "None"}
- Prompt template: ${workflow.promptTemplate ?? "None"}
- Channels: ${workflow.channels.join(", ") || "Not specified"}
- Platforms: ${workflow.platforms.join(", ") || "Not specified"}
- Region: ${workflow.region ?? "Not specified"}
- Country: ${workflow.country ?? "Not specified"}
- Sport: ${workflow.sport ?? "Not specified"}

Brand profile guidance:
- Tone: ${profile?.defaultTone ?? "Not specified"}
- Audience: ${profile?.targetAudience ?? "Not specified"}
- Preferred websites: ${profile?.preferredWebsites.join(", ") || "None"}
- Preferred CTAs: ${profile?.preferredCTAs.join(", ") || "None"}
- Banned phrases: ${profile?.bannedPhrases.join(", ") || "None"}
`.trim();
}

function parseGeneratedBlogs(content: string) {
  const parsed = JSON.parse(content) as { items?: GeneratedBlogItem[] };

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Automation response did not include any blog items.");
  }

  return parsed.items;
}

async function getBrandProfileForWorkflow(workflow: AutomationWorkflow) {
  if (workflow.brandProfileId) {
    return prisma.brandProfile.findUnique({ where: { id: workflow.brandProfileId } });
  }

  if (workflow.brandName) {
    return prisma.brandProfile.findFirst({
      where: {
        brandName: { equals: workflow.brandName, mode: "insensitive" },
      },
    });
  }

  return null;
}

export async function runBlogPostAutomation(input: {
  workflow: AutomationWorkflow;
  triggeredBy: UserAccess;
}) {
  const workflow = input.workflow;
  const profile = await getBrandProfileForWorkflow(workflow);

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

    const items = parseGeneratedBlogs(content);

    const createdBlogs = await Promise.all(
      items.slice(0, workflow.itemCount).map(async (item) => {
        const prepared = {
          title: item.title,
          brand: workflow.brandName ?? profile?.brandName ?? null,
          websites: profile?.preferredWebsites ?? [],
          category: item.category ?? null,
          tags: item.tags ?? [],
          authorName: item.authorName ?? null,
          authorBio: item.authorBio ?? null,
          status: BlogStatus.draft,
          sport: workflow.sport ?? (profile?.sports.length === 1 ? profile.sports[0] : null),
          region: workflow.region ?? (profile?.regions.length === 1 ? profile.regions[0] : null),
          country:
            workflow.country ?? (profile?.countries.length === 1 ? profile.countries[0] : null),
          sources: item.sources ?? [],
          text1: item.text1?.trim() || null,
          text2: item.text2?.trim() || null,
          text3: item.text3?.trim() || null,
          text4: item.text4?.trim() || null,
          text5: item.text5?.trim() || null,
          text6: item.text6?.trim() || null,
          text7: item.text7?.trim() || null,
          text8: item.text8?.trim() || null,
          image1Caption: item.image1Caption?.trim() || null,
          image2Caption: item.image2Caption?.trim() || null,
          image3Caption: item.image3Caption?.trim() || null,
          image4Caption: item.image4Caption?.trim() || null,
          image5Caption: item.image5Caption?.trim() || null,
          image6Caption: item.image6Caption?.trim() || null,
          image7Caption: item.image7Caption?.trim() || null,
          image8Caption: item.image8Caption?.trim() || null,
          aiGenerated: true,
          sourcePrompt: workflow.promptTemplate ?? workflow.description ?? workflow.name,
          createdById: input.triggeredBy.id,
          updatedById: input.triggeredBy.id,
        };

        const { data } = await applyBrandRulesToBlog(prepared);
        return prisma.blog.create({ data });
      }),
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
        summary: `Created ${createdBlogs.length} blog draft${createdBlogs.length === 1 ? "" : "s"}`,
        output: {
          blogIds: createdBlogs.map((item) => item.id),
          titles: createdBlogs.map((item) => item.title),
        },
        completedAt: new Date(),
      },
    });

    await createActionLog({
      userId: input.triggeredBy.id,
      actionType: "run",
      targetType: "automation",
      targetId: workflow.id,
      summary: `Ran automation "${workflow.name}" and created ${createdBlogs.length} blog draft${createdBlogs.length === 1 ? "" : "s"}`,
      afterData: {
        runId: run.id,
        blogIds: createdBlogs.map((item) => item.id),
      },
      source: "automation",
    });

    return {
      runId: run.id,
      createdBlogs,
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
