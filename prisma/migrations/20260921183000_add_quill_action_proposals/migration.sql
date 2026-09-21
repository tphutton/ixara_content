CREATE TYPE "QuillActionStatus" AS ENUM ('pending', 'executing', 'completed', 'rejected', 'failed');

CREATE TABLE "QuillActionProposal" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "QuillActionStatus" NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuillActionProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuillActionProposal_userId_status_createdAt_idx" ON "QuillActionProposal"("userId", "status", "createdAt");
CREATE INDEX "QuillActionProposal_threadId_createdAt_idx" ON "QuillActionProposal"("threadId", "createdAt");

ALTER TABLE "QuillActionProposal" ADD CONSTRAINT "QuillActionProposal_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuillActionProposal" ADD CONSTRAINT "QuillActionProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
