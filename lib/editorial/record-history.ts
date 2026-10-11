import { EditorialCommentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createRecordVersion(input: {
  targetType: string;
  targetId: string;
  snapshot: unknown;
  createdById?: string | null;
  source?: string;
  changeSummary?: string;
}) {
  const latest = await prisma.recordVersion.findFirst({
    where: { targetType: input.targetType, targetId: input.targetId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return prisma.recordVersion.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      version: (latest?.version ?? 0) + 1,
      snapshot: jsonValue(input.snapshot),
      createdById: input.createdById ?? null,
      source: input.source ?? "manual",
      changeSummary: input.changeSummary ?? null,
    },
  });
}

export async function createEditorialComment(input: {
  targetType: string;
  targetId: string;
  body: string;
  createdById: string;
  sectionKey?: string | null;
  fieldKey?: string | null;
  isChangeRequest?: boolean;
  parentId?: string | null;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Comment text is required.");

  return prisma.editorialComment.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      body,
      createdById: input.createdById,
      sectionKey: input.sectionKey ?? null,
      fieldKey: input.fieldKey ?? null,
      isChangeRequest: input.isChangeRequest ?? false,
      parentId: input.parentId ?? null,
    },
    include: { createdBy: { select: { fullName: true, email: true } } },
  });
}

export async function resolveEditorialComment(id: string, userId: string, status: EditorialCommentStatus = EditorialCommentStatus.resolved) {
  return prisma.editorialComment.update({
    where: { id },
    data: { status, resolvedById: userId, resolvedAt: new Date() },
  });
}

export async function listEditorialActivity(targetType: string, targetId: string) {
  const [versions, comments] = await Promise.all([
    prisma.recordVersion.findMany({
      where: { targetType, targetId },
      orderBy: { version: "desc" },
      take: 30,
      include: { createdBy: { select: { fullName: true, email: true } } },
    }),
    prisma.editorialComment.findMany({
      where: { targetType, targetId, parentId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        createdBy: { select: { fullName: true, email: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: { createdBy: { select: { fullName: true, email: true } } },
        },
      },
    }),
  ]);

  return { versions, comments };
}
