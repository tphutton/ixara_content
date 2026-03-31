import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentForm } from "@/components/content/content-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";
import { deleteContentAction, updateContentAction } from "../actions";

export const dynamic = "force-dynamic";

type ContentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContentDetailPage({ params }: ContentDetailPageProps) {
  const { id } = await params;
  const content = await prisma.content.findUnique({ where: { id } });

  if (!content) {
    notFound();
  }

  const updateAction = updateContentAction.bind(null, id);
  const deleteAction = deleteContentAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={content.title}
        description="Edit content copy, targeting metadata, assets, and publication status."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/content">
          Back to content
        </Link>

        <div className="card card--padded">
          <ContentForm action={updateAction} content={content} />
        </div>

        <form action={deleteAction}>
          <SubmitButton label="Delete content" pendingLabel="Deleting..." variant="secondary" />
        </form>
      </div>
    </section>
  );
}
