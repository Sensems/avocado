-- AlterEnum
ALTER TYPE "GitCredentialType" ADD VALUE IF NOT EXISTS 'pat';

-- AlterTable
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "default_branch" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "history_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "webhook_secret" VARCHAR(255);
