-- Integrity rules Prisma's schema language can't express. The API validates the same
-- things, these constraints make sure nothing else (scripts, manual SQL) can break them.

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_date_range_check"
  CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_name_not_blank" CHECK (length(btrim("name")) > 0);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_name_not_blank" CHECK (length(btrim("name")) > 0);

-- completed_at is set exactly when the task is completed
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_completed_at_check"
  CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
