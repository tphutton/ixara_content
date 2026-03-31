import { ChatShell } from "@/components/chat/chat-shell";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ChatPageProps = {
  searchParams: Promise<{ thread?: string }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const access = await requireApprovedUserAccess();
  const { thread: selectedThreadId } = await searchParams;

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

  const messages = activeThreadId
    ? await prisma.chatMessage.findMany({
        where: { threadId: activeThreadId },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="AI Chat"
        description="The assistant layer will execute structured content operations through safe server-side tools."
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
