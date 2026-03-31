import { prisma } from "@/lib/prisma";

function toJsonValue<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T;
}

type LogInput = {
  userId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  summary: string;
  beforeData?: unknown;
  afterData?: unknown;
  source: string;
};

export async function createActionLog(input: LogInput) {
  await prisma.contentActionLog.create({
    data: {
      userId: input.userId,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      beforeData: input.beforeData ? toJsonValue(input.beforeData) : undefined,
      afterData: input.afterData ? toJsonValue(input.afterData) : undefined,
      source: input.source,
    },
  });
}
