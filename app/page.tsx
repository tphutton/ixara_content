import Link from "next/link";

const landingHighlights = [
  {
    title: "Structured content operations",
    description:
      "Manage short-form content, long-form editorial, and publishing schedules from one workspace.",
  },
  {
    title: "AI with guardrails",
    description:
      "Assistant-driven actions stay server-side, auditable, and tied to explicit data models instead of freeform chat claims.",
  },
  {
    title: "Editorial approval flow",
    description:
      "Clerk handles identity while internal access roles and approval states control real workspace entry.",
  },
];

export default function HomePage() {
  return (
    <main className="hero">
      <section className="card card--padded hero__panel">
        <span className="hero__eyebrow">Internal Editorial Workspace</span>
        <h1>Content operations with an Ixara control layer.</h1>
        <p>
          An AI-native content operations platform for teams managing social content,
          structured articles, editorial schedules, and approval-controlled workspace access.
        </p>

        <div className="hero__actions">
          <Link className="button button--primary" href="/sign-in">
            Sign in
          </Link>
          <Link className="button button--secondary" href="/sign-up">
            Request access
          </Link>
        </div>

        <div className="section-grid">
          {landingHighlights.map((item) => (
            <article className="card card--padded" key={item.title}>
              <p className="kicker">Platform</p>
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
