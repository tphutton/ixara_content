import { ChatShell } from "@/components/chat/chat-shell";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ChatPageProps = {
  searchParams: Promise<{ thread?: string; prompt?: string }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const access = await requireApprovedUserAccess();
  const { thread: selectedThreadId, prompt } = await searchParams;

  const threads = await prisma.chatThread.findMany({
    where: {
      userId: access.id,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const activeThreadId =
    selectedThreadId && threads.some((thread) => thread.id === selectedThreadId)
      ? selectedThreadId
      : threads[0]?.id ?? null;

  const [messages, actionProposals] = activeThreadId
    ? await Promise.all([
        prisma.chatMessage.findMany({
          where: { threadId: activeThreadId },
          orderBy: { createdAt: "asc" },
        }),
        prisma.quillActionProposal.findMany({
          where: { threadId: activeThreadId, userId: access.id },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ])
    : [[], []];

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Quill"
        description="Research content operations, prepare changes, and approve every action before it touches live workspace data."
      />

      <ChatShell
        initialMessages={messages.map((message) => ({
          id: message.id,
          role: message.role as "user" | "assistant" | "tool",
          content: message.content,
          toolName: message.toolName,
          toolPayload: message.toolPayload,
          createdAt: message.createdAt.toISOString(),
        }))}
        initialPrompt={prompt ?? ""}
        initialActionProposals={actionProposals.map((proposal) => ({
          id: proposal.id,
          toolName: proposal.toolName,
          summary: proposal.summary,
          status: proposal.status,
          arguments: proposal.arguments as Record<string, unknown>,
          error: proposal.error,
          createdAt: proposal.createdAt.toISOString(),
        }))}
        initialThreadId={activeThreadId}
        initialThreads={threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          updatedAt: thread.updatedAt.toISOString(),
        }))}
      />
    </section>
  );
}
