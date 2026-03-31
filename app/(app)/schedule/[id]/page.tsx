import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { prisma } from "@/lib/prisma";
import { deleteScheduleAction, updateScheduleAction } from "../actions";

export const dynamic = "force-dynamic";

type ScheduleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScheduleDetailPage({ params }: ScheduleDetailPageProps) {
  const { id } = await params;
  const [schedule, contents, blogs] = await Promise.all([
    prisma.contentSchedule.findUnique({ where: { id } }),
    prisma.content.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.blog.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  if (!schedule) {
    notFound();
  }

  const updateAction = updateScheduleAction.bind(null, id);
  const deleteAction = deleteScheduleAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Schedule Entry"
        description="Update scheduling metadata, linked records, publishing status, and operational notes."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/schedule">
          Back to schedule
        </Link>
        <div className="card card--padded">
          <ScheduleForm action={updateAction} blogs={blogs} contents={contents} schedule={schedule} />
        </div>
        <form action={deleteAction}>
          <SubmitButton label="Delete schedule entry" pendingLabel="Deleting..." variant="secondary" />
        </form>
      </div>
    </section>
  );
}
