-- RenameColumn (preserves existing data)
ALTER TABLE "projects" RENAME COLUMN "private_key" TO "private_key_path";

-- ChangeColumnType: TEXT -> VARCHAR(500)
ALTER TABLE "projects" ALTER COLUMN "private_key_path" TYPE VARCHAR(500);
