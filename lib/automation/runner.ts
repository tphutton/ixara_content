import { AutomationStatus, AutomationType, type AutomationWorkflow, type UserAccess } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runWeeklySocialAutomation } from "@/lib/automation/generate-weekly-social";

async function getWorkflowTriggerUser(workflow: AutomationWorkflow) {
  const userId = workflow.updatedById ?? workflow.createdById;

  if (!userId) {
    return null;
  }

  return prisma.userAccess.findUnique({
    where: { id: userId },
  });
}

async function runSingleWorkflow(workflow: AutomationWorkflow, triggeredBy: UserAccess) {
  if (workflow.type === AutomationType.weekly_social_content) {
    return runWeeklySocialAutomation({
      workflow,
      triggeredBy,
    });
  }

  throw new Error(`Unsupported automation type: ${workflow.type}`);
}

export async function runDueAutomations() {
  const now = new Date();
  const workflows = await prisma.automationWorkflow.findMany({
    where: {
      status: AutomationStatus.active,
      nextRunAt: {
        lte: now,
      },
    },
    orderBy: { nextRunAt: "asc" },
  });

  const results = [];

  for (const workflow of workflows) {
    const triggerUser = await getWorkflowTriggerUser(workflow);

    if (!triggerUser) {
      await prisma.automationRun.create({
        data: {
          workflowId: workflow.id,
          status: "failed",
          summary: `Skipped ${workflow.name}`,
          errorMessage: "Automation has no valid owner to attribute the run.",
          completedAt: new Date(),
        },
      });

      results.push({
        workflowId: workflow.id,
        name: workflow.name,
        status: "failed" as const,
        reason: "No valid workflow owner",
      });
      continue;
    }

    try {
      const output = await runSingleWorkflow(workflow, triggerUser);
      results.push({
        workflowId: workflow.id,
        name: workflow.name,
        status: "succeeded" as const,
        createdCount: output.createdContent.length,
      });
    } catch (error) {
      results.push({
        workflowId: workflow.id,
        name: workflow.name,
        status: "failed" as const,
        reason: error instanceof Error ? error.message : "Automation failed.",
      });
    }
  }

  return {
    triggeredAt: now.toISOString(),
    checked: workflows.length,
    results,
  };
}

export async function getAutomationHealthSummary() {
  const now = new Date();
  const [total, active, dueNow, failedRecently, nextDue] = await Promise.all([
    prisma.automationWorkflow.count(),
    prisma.automationWorkflow.count({
      where: { status: AutomationStatus.active },
    }),
    prisma.automationWorkflow.count({
      where: {
        status: AutomationStatus.active,
        nextRunAt: { lte: now },
      },
    }),
    prisma.automationRun.count({
      where: {
        status: "failed",
        startedAt: {
          gte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7),
        },
      },
    }),
    prisma.automationWorkflow.findFirst({
      where: {
        status: AutomationStatus.active,
        nextRunAt: { not: null },
      },
      orderBy: { nextRunAt: "asc" },
      select: {
        id: true,
        name: true,
        nextRunAt: true,
      },
    }),
  ]);

  return {
    total,
    active,
    dueNow,
    failedRecently,
    nextDue,
  };
}
