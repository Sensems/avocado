-- CreateTable
CREATE TABLE "project_im_robots" (
    "project_id" UUID NOT NULL,
    "robot_id" UUID NOT NULL,
    CONSTRAINT "project_im_robots_pkey" PRIMARY KEY ("project_id","robot_id")
);

-- 数据搬迁：把 im_robot_ids 的 JSON 数组展开成关联行。
-- 只保留格式合法且真实存在的机器人 ID，避免外键校验失败。
INSERT INTO "project_im_robots" ("project_id", "robot_id")
SELECT DISTINCT p."id", (elem)::uuid
FROM "projects" p
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
        WHEN jsonb_typeof(p."im_robot_ids") = 'array' THEN p."im_robot_ids"
        ELSE '[]'::jsonb
    END
) AS elem
WHERE (elem) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (SELECT 1 FROM "im_robots" r WHERE r."id" = (elem)::uuid)
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "project_im_robots_robot_id_idx" ON "project_im_robots"("robot_id");

-- AddForeignKey
ALTER TABLE "project_im_robots" ADD CONSTRAINT "project_im_robots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_im_robots" ADD CONSTRAINT "project_im_robots_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "im_robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable（数据已搬迁完成，可以安全删除旧列）
ALTER TABLE "projects" DROP COLUMN "im_robot_ids";
