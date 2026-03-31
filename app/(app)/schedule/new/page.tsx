import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { ScheduleForm } from "@/components/schedule/schedule-form";
import { prisma } from "@/lib/prisma";
import { createScheduleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  const [contents, blogs] = await Promise.all([
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

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="New Schedule Entry"
        description="Create a publishing or campaign scheduling record linked to content or a blog."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/schedule">
          Back to schedule
        </Link>
        <div className="card card--padded">
          <ScheduleForm action={createScheduleAction} blogs={blogs} contents={contents} />
        </div>
      </div>
    </section>
  );
}
