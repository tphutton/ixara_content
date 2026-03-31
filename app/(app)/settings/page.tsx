import { WorkspaceHeader } from "@/components/layout/workspace-header";

const settingsSections = [
  {
    title: "Brand profile foundation",
    description:
      "Store tone, audience, region, website, and phrase preferences that will guide future AI-assisted content generation.",
  },
  {
    title: "Editorial rules",
    description:
      "Define workflow defaults, review expectations, and publishing constraints for different brands and sports.",
  },
];

export default async function SettingsPage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Settings"
        description="Foundation area for workspace-wide brand rules, defaults, and AI operating constraints."
      />

      <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {settingsSections.map((section) => (
          <article className="card card--padded" key={section.title}>
            <h3>{section.title}</h3>
            <p className="muted">{section.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
