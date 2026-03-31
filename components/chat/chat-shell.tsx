"use client";

import Image from "next/image";
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
              ? {
                  ...item,
                  title: item.title || pendingMessage.content.slice(0, 80),
                  updatedAt: new Date().toISOString(),
                }
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
    <div className="chat-workspace">
      <section className="card card--padded chat-workspace__primary">
        <div className="chat-hero">
          <div className="chat-hero__identity">
            <div className="chat-hero__avatar">
              <Image
                alt="Quill avatar"
                height={64}
                src="https://media.ixara.tech/wp-content/uploads/2026/03/5df61a5e-b2be-4944-95b9-ea0f663002fc.webp"
                width={64}
              />
            </div>
            <div>
              <p className="kicker">Quill</p>
              <h3 style={{ margin: "0 0 8px" }}>AI content operations assistant</h3>
              <p className="muted" style={{ margin: 0 }}>
                Quill can create, update, organize, and summarize content operations through
                server-side tools with full audit logging.
              </p>
            </div>
          </div>

          <div className="chat-hero__meta">
            <span className="inline-chip">Active thread: {selectedTitle}</span>
            <span className="inline-chip">Mutation-safe tool flow</span>
          </div>
        </div>

        <div className="chat-log">
          {visibleMessages.length === 0 ? (
            <div className="empty-state">
              <h3>Start a conversation with Quill</h3>
              <p className="muted">
                Try “Create a draft social post for Masters weekend”, “List approved blogs for
                golf”, or “Sync WordPress assets and show me Phuket campaign images.”
              </p>
            </div>
          ) : (
            visibleMessages.map((entry) => (
              <article className="chat-message" data-role={entry.role} key={entry.id}>
                <div className="chat-message__row">
                  <div className="chat-message__avatar" data-role={entry.role}>
                    {entry.role === "assistant" ? (
                      <Image
                        alt="Quill avatar"
                        height={44}
                        src="https://media.ixara.tech/wp-content/uploads/2026/03/5df61a5e-b2be-4944-95b9-ea0f663002fc.webp"
                        width={44}
                      />
                    ) : (
                      <span>Y</span>
                    )}
                  </div>

                  <div className="chat-message__body">
                    <div className="chat-message__meta">
                      <strong>{entry.role === "assistant" ? "Quill" : "You"}</strong>
                      <span className="muted">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{entry.content}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <form className="chat-compose" onSubmit={handleSubmit}>
          <textarea
            disabled={isPending}
            name="message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask Quill to create, update, list, or summarize content operations."
            rows={4}
            value={message}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span className="muted">Database actions run only through server-side tools.</span>
            <button className="button button--primary" disabled={isPending} type="submit">
              {isPending ? "Working..." : "Send"}
            </button>
          </div>
        </form>
      </section>

      <aside className="chat-workspace__secondary">
        <section className="card card--padded">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
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
                  className="chat-thread-card"
                  data-active={thread.id === threadId}
                  key={thread.id}
                  onClick={() => {
                    router.push(`/chat?thread=${thread.id}`);
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
        </section>

        <section className="card card--padded">
          <p className="kicker">Actions taken</p>
          <h3 style={{ marginTop: 0 }}>Latest tool results</h3>

          <div className="stack">
            {lastToolSummaries.length === 0 ? (
              <p className="muted">
                Tool actions will appear here when Quill reads or updates records, assets,
                campaigns, or brand profiles.
              </p>
            ) : (
              lastToolSummaries.map((tool, index) => (
                <article className="chat-tool-card" key={`${tool.toolName}-${index}`}>
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
        </section>
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
