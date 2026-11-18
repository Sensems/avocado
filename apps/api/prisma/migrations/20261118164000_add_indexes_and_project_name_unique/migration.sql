-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
-- CreateIndex
CREATE INDEX "build_tasks_project_id_created_at_idx" ON "build_tasks"("project_id", "created_at");
-- CreateIndex
CREATE INDEX "build_tasks_status_idx" ON "build_tasks"("status");
-- CreateIndex
CREATE INDEX "build_tasks_trigger_user_id_idx" ON "build_tasks"("trigger_user_id");
-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");
-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");
