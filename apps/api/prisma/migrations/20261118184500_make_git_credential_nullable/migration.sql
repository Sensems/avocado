-- 让 projects.git_credential_id 可空，并把外键从 RESTRICT 改为 SET NULL。
--
-- 背景：软删除的项目会一直占着凭证外键（RESTRICT），导致被软删除项目引用过的
-- 凭证永远无法删除。改为可空 + SET NULL 后：
--   1. 软删除项目时会主动把 git_credential_id 置空（见 project-core.service.remove）
--   2. 删除凭证时，数据库自动把引用它的项目的 git_credential_id 置空
--
-- 顺带修复：DTO 里 gitCredentialId 本就是可选的（公开仓库不需要凭证），
-- 但 schema 此前是 NOT NULL，导致不传凭证创建项目会在 Prisma 层报错。

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_git_credential_id_fkey";

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "git_credential_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_git_credential_id_fkey"
  FOREIGN KEY ("git_credential_id") REFERENCES "git_credentials"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
