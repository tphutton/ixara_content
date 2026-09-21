"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { History, ListChecks, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";

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

type ActionProposal = {
  id: string;
  toolName: string;
  summary: string;
  status: "pending" | "executing" | "completed" | "rejected" | "failed";
  arguments: Record<string, unknown>;
  result?: { summary?: string } | null;
  error: string | null;
  createdAt: string;
};

type ChatShellProps = {
  initialThreadId: string | null;
  initialThreads: ChatThread[];
  initialMessages: ChatMessage[];
  initialActionProposals: ActionProposal[];
  initialPrompt?: string;
};

export function ChatShell({
  initialThreadId,
  initialThreads,
  initialMessages,
  initialActionProposals,
  initialPrompt = "",
}: ChatShellProps) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [messages, setMessages] = useState(initialMessages);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [message, setMessage] = useState(initialPrompt);
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
  const [actionProposals, setActionProposals] = useState(initialActionProposals);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [renamingThread, setRenamingThread] = useState<ChatThread | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [sidePanel, setSidePanel] = useState<"actions" | "threads" | "activity">(
    initialActionProposals.some((proposal) => proposal.status === "pending" || proposal.status === "failed")
      ? "actions"
      : "threads",
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
      try {
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
        setMessage(pendingMessage.content);
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
      const proposedActions = (data.toolSummaries ?? [])
        .filter((tool) => tool.payload.requiresApproval && typeof tool.payload.proposalId === "string")
        .map((tool) => ({
          id: String(tool.payload.proposalId),
          toolName: tool.toolName,
          summary: String(tool.payload.summary ?? tool.summary),
          status: "pending" as const,
          arguments:
            tool.payload.arguments && typeof tool.payload.arguments === "object"
              ? tool.payload.arguments as Record<string, unknown>
              : {},
          error: null,
          createdAt: new Date().toISOString(),
        }));
      if (proposedActions.length > 0) {
        setActionProposals((current) => [
          ...proposedActions,
          ...current.filter((item) => !proposedActions.some((proposal) => proposal.id === item.id)),
        ]);
      }

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
      } catch (error) {
        setMessage(pendingMessage.content);
        setMessages((current) => [
          ...current.filter((entry) => entry.id !== pendingMessage.id),
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: error instanceof Error ? error.message : "Quill could not be reached. Your prompt is ready to retry.",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    });
  }

  async function reviewAction(id: string, decision: "approve" | "reject") {
    setProcessingActionId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/chat/actions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = (await response.json()) as { proposal?: ActionProposal; error?: string };
      if (!response.ok || !data.proposal) throw new Error(data.error ?? "Action review failed.");
      setActionProposals((current) =>
        current.map((proposal) => proposal.id === id ? {
          ...proposal,
          status: data.proposal?.status ?? proposal.status,
          error: data.proposal?.error ?? null,
        } : proposal),
      );
      const outcome = decision === "reject"
        ? `Action rejected: ${data.proposal.summary}. No changes were made.`
        : data.proposal.result?.summary
          ? `Approved action completed: ${data.proposal.result.summary}`
          : `Approved action completed: ${data.proposal.summary}`;
      setMessages((current) => [...current, {
        id: `action-${id}-${Date.now()}`,
        role: "assistant",
        content: outcome,
        createdAt: new Date().toISOString(),
      }]);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action review failed.");
    } finally {
      setProcessingActionId(null);
    }
  }

  async function deleteThread(id: string) {
    if (!window.confirm("Delete this conversation and its pending Quill actions?")) return;
    const response = await fetch(`/api/chat/threads/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(data.error ?? "Conversation could not be deleted.");
      return;
    }

    const remaining = threads.filter((thread) => thread.id !== id);
    setThreads(remaining);
    if (threadId === id) {
      setThreadId(null);
      setMessages([]);
      setLastToolSummaries([]);
      setActionProposals([]);
      router.replace(remaining[0] ? `/chat?thread=${remaining[0].id}` : "/chat");
    }
    router.refresh();
  }

  async function renameThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renamingThread || !renameTitle.trim()) return;
    const response = await fetch(`/api/chat/threads/${renamingThread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameTitle }),
    });
    const data = (await response.json()) as { title?: string; error?: string };
    if (!response.ok || !data.title) {
      setActionError(data.error ?? "Conversation could not be renamed.");
      return;
    }
    setThreads((current) => current.map((thread) =>
      thread.id === renamingThread.id ? { ...thread, title: data.title as string } : thread,
    ));
    setRenamingThread(null);
    setRenameTitle("");
    router.refresh();
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
              <p className="muted" style={{ margin: 0 }}>Content planning, creation, quality, and publishing.</p>
            </div>
          </div>

          <div className="chat-hero__meta">
            <span className="inline-chip">Active thread: {selectedTitle}</span>
            {actionProposals.some((proposal) => proposal.status === "pending" || proposal.status === "failed") ? (
              <button className="inline-chip" onClick={() => setSidePanel("actions")} type="button">
                {actionProposals.filter((proposal) => proposal.status === "pending" || proposal.status === "failed").length} action pending
              </button>
            ) : null}
          </div>
        </div>

        <div className="chat-log">
          {visibleMessages.length === 0 ? (
            <div className="empty-state chat-empty-state">
              <h3>What are we working on?</h3>
              <div className="chat-suggestions">
                <button onClick={() => setMessage("Show me what needs attention today.")} type="button">Review today</button>
                <button onClick={() => setMessage("Which scheduled posts are ready to publish to Meta?")} type="button">Publishing readiness</button>
                <button onClick={() => setMessage("Review the weakest content and recommend the highest-impact improvements.")} type="button">Quality review</button>
              </div>
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
            placeholder="Ask Quill about a brand, plan, draft, campaign, or publishing task..."
            rows={3}
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
            <span className="muted">
              {initialPrompt ? "Planner prompt loaded. Edit it or send when ready." : "Quill researches immediately and queues changes for approval."}
            </span>
            <button className="button button--primary" disabled={isPending} type="submit">
              {isPending ? "Working..." : "Send"}
            </button>
          </div>
        </form>
      </section>

      <aside className="card chat-workspace__secondary">
        <div className="chat-side-tabs" role="tablist" aria-label="Quill workspace panels">
          <button data-active={sidePanel === "actions"} onClick={() => setSidePanel("actions")} role="tab" type="button">
            <ListChecks size={16} /> Actions
            {actionProposals.filter((proposal) => proposal.status === "pending" || proposal.status === "failed").length > 0 ? (
              <span>{actionProposals.filter((proposal) => proposal.status === "pending" || proposal.status === "failed").length}</span>
            ) : null}
          </button>
          <button data-active={sidePanel === "threads"} onClick={() => setSidePanel("threads")} role="tab" type="button">
            <MessageSquareText size={16} /> Threads
          </button>
          <button data-active={sidePanel === "activity"} onClick={() => setSidePanel("activity")} role="tab" type="button">
            <History size={16} /> Activity
          </button>
        </div>

        <div className="chat-side-panel">
          {actionError ? <div className="form-error">{actionError}</div> : null}

          {sidePanel === "threads" ? (
            <>
              <div className="section-heading">
                <div><p className="kicker">Conversations</p><h3>Recent threads</h3></div>
                <button className="button button--secondary" onClick={() => {
                  setThreadId(null); setMessages([]); setLastToolSummaries([]); setActionProposals([]); router.replace("/chat");
                }} type="button"><Plus size={15} /> New</button>
              </div>
              <div className="stack">
                {threads.length === 0 ? <p className="muted">No conversations yet.</p> : threads.map((thread) => (
                  <div className="chat-thread-row" key={thread.id}>
                    <button className="chat-thread-card" data-active={thread.id === threadId} onClick={() => router.push(`/chat?thread=${thread.id}`)} type="button">
                      <strong>{thread.title}</strong><p className="muted">{new Date(thread.updatedAt).toLocaleString()}</p>
                    </button>
                    <button aria-label={`Rename ${thread.title}`} className="chat-thread-rename" onClick={() => { setRenamingThread(thread); setRenameTitle(thread.title); }} title="Rename conversation" type="button"><Pencil size={15} /></button>
                    <button aria-label={`Delete ${thread.title}`} className="chat-thread-delete" onClick={() => deleteThread(thread.id)} title="Delete conversation" type="button"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {sidePanel === "actions" ? (
            <>
              <div className="section-heading"><div><p className="kicker">Approval queue</p><h3>Proposed changes</h3></div><Link className="button button--secondary" href="/actions">View all</Link></div>
              <div className="stack">
                {actionProposals.length === 0 ? <p className="muted">No proposed changes in this thread.</p> : actionProposals.map((proposal) => {
                  const reviewable = proposal.status === "pending" || proposal.status === "failed";
                  const busy = processingActionId === proposal.id;
                  return <article className="chat-tool-card quill-action-card" key={proposal.id}>
                    <div className="quiet-row__title"><strong>{proposal.summary}</strong><span className="badge">{proposal.status}</span></div>
                    {getProposalHighlights(proposal.arguments).length > 0 ? <dl className="quill-action-card__details">{getProposalHighlights(proposal.arguments).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
                    {proposal.error ? <p className="form-error">{proposal.error}</p> : null}
                    {reviewable ? <div className="row-actions">
                      <button className="button button--secondary" disabled={busy} onClick={() => reviewAction(proposal.id, "reject")} type="button">Reject</button>
                      <button className="button button--primary" disabled={busy} onClick={() => reviewAction(proposal.id, "approve")} type="button">{busy ? "Running..." : proposal.status === "failed" ? "Retry" : "Approve"}</button>
                    </div> : null}
                  </article>;
                })}
              </div>
            </>
          ) : null}

          {sidePanel === "activity" ? (
            <>
              <div><p className="kicker">Current request</p><h3>Tool activity</h3></div>
              <div className="stack">
                {lastToolSummaries.length === 0 ? <p className="muted">No tool activity yet.</p> : lastToolSummaries.map((tool, index) => (
                  <article className="chat-tool-card" key={`${tool.toolName}-${index}`}><strong>{tool.toolName}</strong><p className="muted">{tool.summary}</p>
                    {getToolHighlights(tool.payload).length > 0 ? <div className="quiet-meta">{getToolHighlights(tool.payload).map((line) => <span key={line}>{line}</span>)}</div> : null}
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </aside>

      {renamingThread ? (
        <div className="editor-overlay editor-overlay--dialog">
          <button
            aria-label="Close rename conversation"
            className="editor-overlay__backdrop"
            onClick={() => setRenamingThread(null)}
            type="button"
          />
          <section className="editor-overlay__panel quill-rename-panel">
            <div className="editor-overlay__header">
              <div><p className="kicker">Conversation</p><h3>Rename thread</h3></div>
              <button className="button button--secondary" onClick={() => setRenamingThread(null)} type="button">Close</button>
            </div>
            <form className="editor-overlay__content quiet-form" onSubmit={renameThread}>
              <label className="field">
                <span className="field__label">Title</span>
                <input autoFocus maxLength={80} onChange={(event) => setRenameTitle(event.target.value)} value={renameTitle} />
              </label>
              <div className="form-actions">
                <button className="button button--primary" type="submit">Save title</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function getToolHighlights(payload: Record<string, unknown>) {
  const entries = Object.entries(payload)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .slice(0, 3);

  return entries.map(([key, value]) => `${key}: ${String(value)}`);
}

function getProposalHighlights(args: Record<string, unknown>) {
  const hiddenKeys = new Set(["accessToken", "token", "secret", "password"]);
  return Object.entries(args)
    .filter(([key, value]) => !hiddenKeys.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    .slice(0, 6)
    .map(([key, value]) => [key.replace(/([A-Z])/g, " $1"), String(value)] as const);
}
