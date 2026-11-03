import { prisma } from '@/lib/prisma';
import type { Operation } from './engine';

export function summarizeReservations(budget: number | null, jobs: Array<{id:string; status:string; targetType:string; input: unknown}>) {
  const reservations = jobs.map(job => {
    const input = job.input && typeof job.input === 'object' && !Array.isArray(job.input) ? job.input as Record<string, unknown> : {};
    const estimate = input.estimatedCredits;
    return { id: job.id, status: job.status, targetType: job.targetType, estimatedCredits: typeof estimate === 'number' && Number.isFinite(estimate) ? estimate : 0 };
  });
  const reservedCredits = reservations.reduce((sum, job) => sum + job.estimatedCredits, 0);
  return { budget, reservedCredits, remainingCredits: budget === null ? null : Math.max(0, budget - reservedCredits), reservations, note: 'Reservations include failed and cancelled jobs and are estimates, not provider-enforced spending caps or invoices.' };
}

export const productionBudgetOperation: Operation = {
  name: 'get_plan_media_budget',
  description: 'Read the plan credit limit and existing Runway reservations before preparing jobs. Estimates are not provider billing caps.',
  scope: 'ixara-content:read', mutating: false,
  inputSchema: {type:'object', properties:{planId:{type:'string'}}, required:['planId'], additionalProperties:false},
  run: async args => {
    const plan = await prisma.contentPlan.findUniqueOrThrow({where:{id:args.planId}, select:{id:true,title:true,mediaCreditBudget:true}});
    const jobs = await prisma.mediaGenerationJob.findMany({where:{provider:'runway',input:{path:['planId'],equals:plan.id}},select:{id:true,status:true,targetType:true,input:true},orderBy:{createdAt:'asc'}});
    return {planId:plan.id,title:plan.title,...summarizeReservations(plan.mediaCreditBudget,jobs)};
  },
};
