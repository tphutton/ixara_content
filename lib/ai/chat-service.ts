import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { prisma } from "@/lib/prisma";
import { executeContentOpsTool, contentOpsTools } from "@/lib/ai/tools";
import { getOpenAIClient } from "@/lib/openai";
import { type CurrentUserAccess } from "@/lib/auth/user-access";

const SYSTEM_PROMPT = `
You are Content Ops AI, a concise content operations assistant.

Your job is to help approved internal users manage:
- short-form content records
- structured blog/article records
- schedule entries
- external campaign records
- editorial dashboard summaries
- synced media assets
- brand profile rules
- connected social accounts
- published post history and analytics snapshots

Rules:
- Use tools when database reads or writes are needed.
- Never claim a record was created or updated unless a tool succeeded.
- When creating or updating data, summarize the exact records changed.
- Ask a brief clarifying question only if a required field is genuinely missing.
- For blogs, preserve the structured text/image block model and do not collapse them into one generic body.
- If a user asks for lists or summaries, prefer tool-driven results over guessing.
- Use brand profile context whenever it is available so tone, audience, geography, CTA style, and banned phrases stay aligned.
- Use asset tools when users need to find creative, verify available media, or attach WordPress-backed assets to records.
- Use automation tools when users ask about recurring workflows, automation health, upcoming runs, or when they want to trigger a safe automation manually.
- Use analytics tools when users ask what performed well, what underperformed, which accounts are connected, or how past posts have done.
`.trim();

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";

type StoredChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName: string | null;
  toolPayload: unknown;
};

type StoredAssistantToolPayload = {
  toolCalls?: ChatCompletionAssistantMessageParam["tool_calls"];
};

function getThreadTitle(message: string) {
  return message.trim().slice(0, 80) || "New chat";
}

async function getBrandProfilePromptContext() {
  const profiles = await prisma.brandProfile.findMany({
    orderBy: { brandName: "asc" },
    take: 12,
  });

  if (profiles.length === 0) {
    return "No brand profiles are configured yet.";
  }

  return profiles
    .map((profile) => {
      const details = [
        `Brand: ${profile.brandName}`,
        profile.defaultTone ? `Tone: ${profile.defaultTone}` : null,
        profile.targetAudience ? `Audience: ${profile.targetAudience}` : null,
        profile.preferredWebsites.length > 0
          ? `Websites: ${profile.preferredWebsites.join(", ")}`
          : null,
        profile.sports.length > 0 ? `Sports: ${profile.sports.join(", ")}` : null,
        profile.regions.length > 0 ? `Regions: ${profile.regions.join(", ")}` : null,
        profile.countries.length > 0 ? `Countries: ${profile.countries.join(", ")}` : null,
        profile.preferredCTAs.length > 0
          ? `Preferred CTAs: ${profile.preferredCTAs.join(", ")}`
          : null,
        profile.bannedPhrases.length > 0
          ? `Banned phrases: ${profile.bannedPhrases.join(", ")}`
          : null,
      ].filter(Boolean);

      return `- ${details.join(" | ")}`;
    })
    .join("\n");
}

function toOpenAIMessages(
  messages: StoredChatMessage[],
  brandProfileContext: string,
): ChatCompletionMessageParam[] {
  const conversation: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nCurrent brand profiles:\n${brandProfileContext}`,
    },
  ];

  let lastAssistantHadToolCalls = false;

  for (const message of messages) {
    if (message.role === "tool") {
      if (!lastAssistantHadToolCalls) {
        continue;
      }

      conversation.push({
        role: "tool",
        content: message.content,
        tool_call_id:
          (message.toolPayload as { toolCallId?: string } | null)?.toolCallId ?? message.id,
      });
      continue;
    }

    if (message.role === "assistant") {
      const toolCalls = (message.toolPayload as StoredAssistantToolPayload | null)?.toolCalls;

      if (toolCalls?.length) {
        conversation.push({
          role: "assistant",
          content: message.content,
          tool_calls: toolCalls,
        });
        lastAssistantHadToolCalls = true;
        continue;
      }

      conversation.push({
        role: "assistant",
        content: message.content,
      });
      lastAssistantHadToolCalls = false;
      continue;
    }

    conversation.push({
      role: "user",
      content: message.content,
    });
    lastAssistantHadToolCalls = false;
  }

  return conversation;
}

async function getOrCreateThread(access: CurrentUserAccess, threadId: string | undefined, message: string) {
  if (threadId) {
    const existing = await prisma.chatThread.findFirst({
      where: {
        id: threadId,
        userId: access.id,
      },
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.chatThread.create({
    data: {
      userId: access.id,
      title: getThreadTitle(message),
      contextType: "content_ops",
    },
  });
}

async function saveToolMessages(threadId: string, toolResults: Array<{ toolName: string; content: string; payload: unknown }>) {
  if (toolResults.length === 0) {
    return [];
  }

  return Promise.all(
    toolResults.map((toolResult) =>
      prisma.chatMessage.create({
        data: {
          threadId,
          role: "tool",
          content: toolResult.content,
          toolName: toolResult.toolName,
          toolPayload: toolResult.payload as object,
        },
      }),
    ),
  );
}

async function saveAssistantToolCallMessage(input: {
  threadId: string;
  content: string;
  toolCalls: NonNullable<ChatCompletionAssistantMessageParam["tool_calls"]>;
}) {
  return prisma.chatMessage.create({
    data: {
      threadId: input.threadId,
      role: "assistant",
      content: input.content,
      toolPayload: JSON.parse(
        JSON.stringify({
          toolCalls: input.toolCalls,
        }),
      ) as object,
    },
  });
}

export async function runContentOpsChat(input: {
  access: CurrentUserAccess;
  message: string;
  threadId?: string;
}) {
  const client = getOpenAIClient();
  const thread = await getOrCreateThread(input.access, input.threadId, input.message);

  const userMessage = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "user",
      content: input.message,
    },
  });

  const storedMessages = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const brandProfileContext = await getBrandProfilePromptContext();

  const conversation: ChatCompletionMessageParam[] = toOpenAIMessages(
    storedMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      toolName: message.toolName,
      toolPayload: message.toolPayload,
    })),
    brandProfileContext,
  );

  const toolSummaries: Array<{ toolName: string; summary: string; payload: Record<string, unknown> }> = [];
  let assistantText = "";

  for (let step = 0; step < 6; step += 1) {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: conversation,
      tools: contentOpsTools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error("OpenAI returned no assistant message.");
    }

    if (assistantMessage.tool_calls?.length) {
      await saveAssistantToolCallMessage({
        threadId: thread.id,
        content: assistantMessage.content ?? "",
        toolCalls: assistantMessage.tool_calls,
      });

      conversation.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        tool_calls: assistantMessage.tool_calls,
      });

      const toolMessages = [];

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") {
          continue;
        }

        const args = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
        let result;

        try {
          result = await executeContentOpsTool(toolCall.function.name, args, {
            access: input.access,
          });
        } catch (error) {
          result = {
            toolName: toolCall.function.name,
            summary: error instanceof Error ? error.message : "Tool execution failed.",
            payload: {
              error: error instanceof Error ? error.message : "Tool execution failed.",
            },
          };
        }

        toolSummaries.push(result);

        const content = JSON.stringify(result.payload);
        toolMessages.push({
          toolName: result.toolName,
          content,
          payload: {
            toolCallId: toolCall.id,
            summary: result.summary,
            result: result.payload,
          },
        });

        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content,
        });
      }

      await saveToolMessages(thread.id, toolMessages);
      continue;
    }

    assistantText = assistantMessage.content ?? "I completed the requested review, but I do not have additional text to return.";
    break;
  }

  if (!assistantText) {
    assistantText =
      toolSummaries.length > 0
        ? `Completed ${toolSummaries.length} tool action${toolSummaries.length === 1 ? "" : "s"}.`
        : "I wasn't able to complete that request.";
  }

  const savedAssistantMessage = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      content: assistantText,
    },
  });

  await prisma.chatThread.update({
    where: { id: thread.id },
    data: {
      title:
        storedMessages.length <= 1 ? getThreadTitle(input.message) : thread.title,
    },
  });

  return {
    threadId: thread.id,
    userMessage: {
      id: userMessage.id,
      role: "user" as const,
      content: userMessage.content,
      createdAt: userMessage.createdAt.toISOString(),
    },
    assistantMessage: {
      id: savedAssistantMessage.id,
      role: "assistant" as const,
      content: savedAssistantMessage.content,
      createdAt: savedAssistantMessage.createdAt.toISOString(),
    },
    toolSummaries,
  };
}
