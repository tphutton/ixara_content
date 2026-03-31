import { WorkspaceHeader } from "@/components/layout/workspace-header";

export default async function ChatPage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="AI Chat"
        description="The assistant layer will execute structured content operations through safe server-side tools."
      />

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <section className="card card--padded">
          <p className="kicker">Phase 1 foundation</p>
          <h3>Conversation workspace coming in Phase 4</h3>
          <p className="muted">
            This panel is reserved for persisted chat threads, assistant messages, and
            tool-driven action summaries. The OpenAI tool-calling route and message store
            will be added after CRUD foundations are in place.
          </p>
        </section>

        <aside className="card card--padded">
          <p className="kicker">Planned tool actions</p>
          <div className="stack">
            <span className="inline-chip">List content</span>
            <span className="inline-chip">Create blog</span>
            <span className="inline-chip">Update schedule</span>
            <span className="inline-chip">Get dashboard summary</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
