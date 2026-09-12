-- DevVault: persistent import jobs, AI provenance, and drift reconciliation.
--
-- This migration is written by hand (rather than dumped by `prisma migrate dev`)
-- for two reasons:
--   1. It also reconciles pre-existing drift: the 20260719153310_init migration
--      predates `Project.sourceRepo`, `Note.projectId` and `Snippet.projectId`,
--      which had been added to schema.prisma but only applied with `prisma db push`.
--   2. The project's documented local workflow is `prisma db push`, so existing
--      databases may already contain some of these columns. Everything below is
--      therefore idempotent, so it is safe to run against either a fresh database
--      or one that was created with `db push`.
--
-- After applying, `npx prisma migrate status` should report the schema as in sync.

-- ─── Enums ──────────────────────────────────────────────────────────────────

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."ImportStage" AS ENUM ('QUEUED', 'CONNECTED', 'READING', 'ANALYZING', 'SAVING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Drift reconciliation (columns added to schema.prisma after init) ───────

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "sourceRepo" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Snippet" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- ─── ImportJob ──────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "branch" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "stage" "ImportStage" NOT NULL DEFAULT 'QUEUED',
    "stageLabel" TEXT NOT NULL DEFAULT 'Queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "currentFile" TEXT,
    "totalBatches" INTEGER NOT NULL DEFAULT 0,
    "completedBatches" INTEGER NOT NULL DEFAULT 0,
    "notesCreated" INTEGER NOT NULL DEFAULT 0,
    "snippetsCreated" INTEGER NOT NULL DEFAULT 0,
    "tasksCreated" INTEGER NOT NULL DEFAULT 0,
    "filesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "warning" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_userId_status_idx" ON "ImportJob"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt");

-- ─── AI provenance on generated content ─────────────────────────────────────

ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "generatedByAI" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "sourcePath" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "importJobId" TEXT;

ALTER TABLE "Snippet" ADD COLUMN IF NOT EXISTS "generatedByAI" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Snippet" ADD COLUMN IF NOT EXISTS "sourcePath" TEXT;
ALTER TABLE "Snippet" ADD COLUMN IF NOT EXISTS "importJobId" TEXT;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "generatedByAI" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "sourcePath" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "importJobId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Note_userId_isArchived_idx" ON "Note"("userId", "isArchived");
CREATE INDEX IF NOT EXISTS "Note_importJobId_idx" ON "Note"("importJobId");
CREATE INDEX IF NOT EXISTS "Snippet_userId_idx" ON "Snippet"("userId");
CREATE INDEX IF NOT EXISTS "Snippet_importJobId_idx" ON "Snippet"("importJobId");
CREATE INDEX IF NOT EXISTS "Task_projectId_status_idx" ON "Task"("projectId", "status");
CREATE INDEX IF NOT EXISTS "Task_userId_idx" ON "Task"("userId");
CREATE INDEX IF NOT EXISTS "Task_importJobId_idx" ON "Task"("importJobId");
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");
CREATE INDEX IF NOT EXISTS "OAuthAccount_userId_provider_idx" ON "OAuthAccount"("userId", "provider");

-- ─── Account deletion with tasks present ───────────────────────────────────
-- Task.userId was ON DELETE RESTRICT, which made `DELETE /users/account` fail
-- for any user who had ever created a task (the Task -> Project cascade cannot
-- rescue a second, restricting FK on the same row).

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_userId_fkey";

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Session invalidation ───────────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

-- ─── Foreign keys ───────────────────────────────────────────────────────────

-- AddForeignKey: Note.project / Snippet.project (missing from the init migration)
DO $$ BEGIN
    ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Snippet" ADD CONSTRAINT "Snippet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: ImportJob
DO $$ BEGIN
    ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: provenance links (dropping the job's row must never delete user content)
DO $$ BEGIN
    ALTER TABLE "Note" ADD CONSTRAINT "Note_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Snippet" ADD CONSTRAINT "Snippet_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
