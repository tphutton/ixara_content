import Link from "next/link";
import { AutomationForm } from "@/components/automations/automation-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";
import { createAutomationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAutomationPage() {
  const brandProfiles = await prisma.brandProfile.findMany({
    select: { id: true, brandName: true },
    orderBy: { brandName: "asc" },
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="New Automation"
        description="Set up a recurring content workflow that can generate weekly draft content and later feed broader automation routines."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/automations">
          Back to automations
        </Link>
        <div className="card card--padded">
          <AutomationForm action={createAutomationAction} brandProfiles={brandProfiles} />
        </div>
      </div>
    </section>
  );
}
