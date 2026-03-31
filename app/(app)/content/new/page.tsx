import Link from "next/link";
import { ContentForm } from "@/components/content/content-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { createContentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewContentPage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="New Content"
        description="Create a short-form content record with operational metadata, assets, and publishing context."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/content">
          Back to content
        </Link>
        <div className="card card--padded">
          <ContentForm action={createContentAction} />
        </div>
      </div>
    </section>
  );
}
