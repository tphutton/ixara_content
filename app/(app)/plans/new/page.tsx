import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { PlanForm } from "@/components/plans/plan-form";
import { prisma } from "@/lib/prisma";
import { createContentPlanAction } from "../actions";

export default async function NewPlanPage() {
  const brandProfiles = await prisma.brandProfile.findMany({
    select: { id: true, brandName: true },
    orderBy: { brandName: "asc" },
  });

  return (
    <section className="page-shell page-shell--narrow">
      <WorkspaceHeader
        title="New plan"
        description="Create the planning container first. Quill can then add briefs, channels, asset needs, and schedule targets."
        actions={
          <Link className="button button--secondary" href="/plans">
            Back to plans
          </Link>
        }
      />

      <section className="quiet-panel">
        <PlanForm action={createContentPlanAction} brandProfiles={brandProfiles} submitLabel="Create plan" />
      </section>
    </section>
  );
}
