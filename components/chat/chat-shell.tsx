"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string | null;
  toolPayload?: unknown;
  createdAt: string;
};

type ChatThread = {
  id: string;
  title: string;
  updatedAt: string;
};

type ToolSummary = {
  toolName: string;
  summary: string;
  payload: Record<string, unknown>;
};

type ChatShellProps = {
  initialThreadId: string | null;
  initialThreads: ChatThread[];
  initialMessages: ChatMessage[];
};

export function ChatShell({
  initialThreadId,
  initialThreads,
  initialMessages,
}: ChatShellProps) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [messages, setMessages] = useState(initialMessages);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [lastToolSummaries, setLastToolSummaries] = useState<ToolSummary[]>(
    initialMessages
      .filter((entry) => entry.role === "tool")
      .map((entry) => ({
        toolName: entry.toolName ?? "tool",
        summary:
          (entry.toolPayload as { summary?: string } | null)?.summary ?? entry.content,
        payload:
          (entry.toolPayload as { result?: Record<string, unknown> } | null)?.result ?? {},
      }))
      .slice(-6),
  );

  const selectedTitle = useMemo(() => {
    return threads.find((item) => item.id === threadId)?.title ?? "New thread";
  }, [threadId, threads]);
  const visibleMessages = useMemo(
    () => messages.filter((entry) => entry.role !== "tool"),
    [messages],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    const pendingMessage = {
      id: `pending-${Date.now()}`,
      role: "user" as const,
      content: message,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, pendingMessage]);
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: pendingMessage.content,
          threadId,
        }),
      });

      const data = (await response.json()) as
        | {
            error?: string;
            threadId?: string;
            userMessage?: ChatMessage;
            assistantMessage?: ChatMessage;
            toolSummaries?: ToolSummary[];
          }
        | undefined;

      if (!response.ok || !data?.assistantMessage || !data.userMessage || !data.threadId) {
        setMessages((current) => [
          ...current.filter((entry) => entry.id !== pendingMessage.id),
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: data?.error ?? "The assistant request failed.",
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      const confirmedUserMessage = data.userMessage;
      const confirmedAssistantMessage = data.assistantMessage;
      const confirmedThreadId = data.threadId;

      setThreadId(confirmedThreadId);
      setMessages((current) => [
        ...current.filter((entry) => entry.id !== pendingMessage.id),
        confirmedUserMessage,
        confirmedAssistantMessage,
      ]);
      setLastToolSummaries(data.toolSummaries ?? []);

      setThreads((current) => {
        const exists = current.some((item) => item.id === confirmedThreadId);

        if (exists) {
          return current.map((item) =>
            item.id === confirmedThreadId
              ? { ...item, title: item.title || pendingMessage.content.slice(0, 80), updatedAt: new Date().toISOString() }
              : item,
          );
        }

        return [
          {
            id: confirmedThreadId,
            title: pendingMessage.content.slice(0, 80),
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ];
      });

      router.replace(`/chat?thread=${confirmedThreadId}`);
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "280px minmax(0, 1fr) 320px", alignItems: "start" }}>
      <aside className="card card--padded">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <p className="kicker">Threads</p>
            <h3 style={{ marginTop: 0 }}>Recent conversations</h3>
          </div>
          <button
            className="button button--secondary"
            onClick={() => {
              setThreadId(null);
              setMessages([]);
              setLastToolSummaries([]);
              router.replace("/chat");
            }}
            type="button"
          >
            New
          </button>
        </div>

        <div className="stack">
          {threads.length === 0 ? (
            <p className="muted">No threads yet.</p>
          ) : (
            threads.map((thread) => (
              <button
                className="card card--padded"
                key={thread.id}
                onClick={() => {
                  router.push(`/chat?thread=${thread.id}`);
                }}
                style={{
                  textAlign: "left",
                  borderColor: thread.id === threadId ? "rgba(15, 118, 110, 0.28)" : undefined,
                }}
                type="button"
              >
                <strong>{thread.title}</strong>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {new Date(thread.updatedAt).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="card card--padded">
        <p className="kicker">Active thread</p>
        <h3 style={{ marginTop: 0 }}>{selectedTitle}</h3>

        <div className="chat-log">
          {visibleMessages.length === 0 ? (
            <div className="empty-state">
              <h3>Start a content ops conversation</h3>
              <p className="muted">Try “Create a draft social post for Masters weekend” or “List approved blogs for golf.”</p>
            </div>
          ) : (
            visibleMessages.map((entry) => (
              <article
                className="chat-message"
                data-role={entry.role}
                key={entry.id}
              >
                <div className="chat-message__meta">
                  <strong>{entry.role === "assistant" ? "Assistant" : entry.role === "user" ? "You" : entry.toolName ?? "Tool"}</strong>
                  <span className="muted">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                </div>
                <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{entry.content}</p>
              </article>
            ))
          )}
        </div>

        <form className="chat-compose" onSubmit={handleSubmit}>
          <textarea
            disabled={isPending}
            name="message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask the assistant to create, update, list, or summarize content operations."
            rows={4}
            value={message}
          />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <span className="muted">Database actions run only through server-side tools.</span>
            <button className="button button--primary" disabled={isPending} type="submit">
              {isPending ? "Working..." : "Send"}
            </button>
          </div>
        </form>
      </section>

      <aside className="card card--padded">
        <p className="kicker">Actions taken</p>
        <h3 style={{ marginTop: 0 }}>Latest tool results</h3>

        <div className="stack">
              {lastToolSummaries.length === 0 ? (
                <p className="muted">Tool actions will appear here when the assistant reads or updates records.</p>
              ) : (
            lastToolSummaries.map((tool, index) => (
              <article className="card card--padded" key={`${tool.toolName}-${index}`}>
                <strong>{tool.toolName}</strong>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {tool.summary}
                </p>
                {getToolHighlights(tool.payload).length > 0 ? (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {getToolHighlights(tool.payload).map((line) => (
                      <span className="inline-chip" key={line}>
                        {line}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
  function getToolHighlights(payload: Record<string, unknown>) {
    const entries = Object.entries(payload)
      .filter(([, value]) => typeof value === "string" || typeof value === "number")
      .slice(0, 3);

    return entries.map(([key, value]) => `${key}: ${String(value)}`);
  }
