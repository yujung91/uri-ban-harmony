-- New Supabase project only. No Sites data or sample users are imported.
BEGIN;
CREATE SCHEMA IF NOT EXISTS harmony;
SET LOCAL search_path TO harmony, pg_temp;

CREATE TABLE IF NOT EXISTS "classes" (
  "id" text NOT NULL,
  "owner" text NOT NULL,
  "code" text NOT NULL,
  "project" text NOT NULL,
  "stage" integer NOT NULL DEFAULT 0,
  "version" integer NOT NULL DEFAULT 1,
  "plays" integer NOT NULL DEFAULT 0,
  "joinOpen" integer NOT NULL DEFAULT 1,
  "created" bigint NOT NULL,
  "movie" text,
  PRIMARY KEY ("id")
 );
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS "classes_code_unique" ON "classes" ("code");

CREATE TABLE IF NOT EXISTS "creation_choices" (
  "classId" text NOT NULL,
  "studentId" text NOT NULL,
  "studentDraftId" text,
  "teacherDraftId" text,
  "delegate" integer NOT NULL DEFAULT 0,
  "position" integer NOT NULL,
  "teacherBlocked" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("classId", "studentId")
 );
ALTER TABLE "creation_choices" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "creation_drafts" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "studentId" text NOT NULL,
  "data" text NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "updated" bigint NOT NULL,
  "deletedAt" bigint,
  PRIMARY KEY ("id"),
  UNIQUE (id, "classId", "studentId")
 );
ALTER TABLE "creation_drafts" ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS "creation_draft_student" ON "creation_drafts" ("classId", "studentId");

CREATE TABLE IF NOT EXISTS "creation_files" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "studentId" text NOT NULL,
  "draftId" text NOT NULL,
  "objectKey" text NOT NULL,
  "created" bigint NOT NULL,
  PRIMARY KEY ("id")
 );
ALTER TABLE "creation_files" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "creation_history" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "draftId" text NOT NULL,
  "actor" text NOT NULL,
  "data" text NOT NULL,
  "created" bigint NOT NULL,
  PRIMARY KEY ("id")
 );
ALTER TABLE "creation_history" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "creation_sessions" (
  "tokenHash" text NOT NULL,
  "studentId" text NOT NULL,
  "authVersion" integer NOT NULL,
  "expires" bigint NOT NULL,
  PRIMARY KEY ("tokenHash")
 );
ALTER TABLE "creation_sessions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "creation_students" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "number" integer NOT NULL,
  "salt" text NOT NULL,
  "pinHash" text NOT NULL,
  "authVersion" integer NOT NULL DEFAULT 1,
  "created" bigint NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE (id, "classId"),
  CHECK (number BETWEEN 1 AND 100)
 );
ALTER TABLE "creation_students" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS "creation_student_number" ON "creation_students" ("classId", "number");

CREATE TABLE IF NOT EXISTS "creation_submissions" (
  "draftId" text NOT NULL,
  "classId" text NOT NULL,
  "studentId" text NOT NULL,
  "data" text NOT NULL,
  "original" text NOT NULL,
  "revision" integer NOT NULL,
  "teacherData" text,
  "teacherRevision" integer NOT NULL DEFAULT 0,
  "submitted" bigint NOT NULL,
  PRIMARY KEY ("draftId")
 );
ALTER TABLE "creation_submissions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "limits" (
  "id" text NOT NULL,
  "hits" integer NOT NULL,
  "reset" bigint NOT NULL,
  PRIMARY KEY ("id")
 );
ALTER TABLE "limits" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "media" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "memberId" text NOT NULL,
  "kind" text NOT NULL,
  "type" text NOT NULL,
  "size" integer NOT NULL,
  "created" bigint NOT NULL,
  PRIMARY KEY ("id")
 );
ALTER TABLE "media" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "members" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "tokenHash" text NOT NULL,
  "nickname" text NOT NULL,
  "created" bigint NOT NULL,
  PRIMARY KEY ("id")
 );
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS "members_tokenHash_unique" ON "members" ("tokenHash");

CREATE TABLE IF NOT EXISTS "revisions" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "entity" text NOT NULL,
  "itemId" text NOT NULL,
  "snapshot" text NOT NULL,
  "created" bigint NOT NULL,
  PRIMARY KEY ("id")
 );
ALTER TABLE "revisions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "rules" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "authorId" text NOT NULL,
  "text" text NOT NULL,
  "kind" text NOT NULL,
  "media" text,
  "status" text NOT NULL DEFAULT 'pending',
  "emoji" text NOT NULL,
  "created" bigint NOT NULL,
  "original" text,
  "edited" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
 );
ALTER TABLE "rules" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "scenes" (
  "classId" text NOT NULL,
  "workId" text NOT NULL,
  "position" integer NOT NULL,
  PRIMARY KEY ("classId", "workId")
 );
ALTER TABLE "scenes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "selected" (
  "classId" text NOT NULL,
  "ruleId" text NOT NULL,
  "position" integer NOT NULL,
  PRIMARY KEY ("classId", "ruleId")
 );
ALTER TABLE "selected" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "versions" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "version" integer NOT NULL,
  "snapshot" text NOT NULL,
  "created" bigint NOT NULL,
  PRIMARY KEY ("id")
 );
ALTER TABLE "versions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "votes" (
  "ruleId" text NOT NULL,
  "memberId" text NOT NULL,
  PRIMARY KEY ("ruleId", "memberId")
 );
ALTER TABLE "votes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "works" (
  "id" text NOT NULL,
  "classId" text NOT NULL,
  "authorId" text NOT NULL,
  "title" text NOT NULL,
  "text" text NOT NULL,
  "kind" text NOT NULL,
  "media" text,
  "beats" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created" bigint NOT NULL,
  "ruleId" text,
  "payload" text,
  "original" text,
  "edited" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
 );
ALTER TABLE "works" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_choices_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_choices" ADD CONSTRAINT "creation_choices_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_choices_studentId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_choices" ADD CONSTRAINT "creation_choices_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "creation_students"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_drafts_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_drafts" ADD CONSTRAINT "creation_drafts_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_drafts_studentId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_drafts" ADD CONSTRAINT "creation_drafts_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "creation_students"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_files_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_files" ADD CONSTRAINT "creation_files_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_files_studentId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_files" ADD CONSTRAINT "creation_files_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "creation_students"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_history_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_history" ADD CONSTRAINT "creation_history_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_sessions_studentId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_sessions" ADD CONSTRAINT "creation_sessions_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "creation_students"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_students_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_students" ADD CONSTRAINT "creation_students_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_submissions_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_submissions" ADD CONSTRAINT "creation_submissions_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creation_submissions_studentId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "creation_submissions" ADD CONSTRAINT "creation_submissions_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "creation_students"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "media" ADD CONSTRAINT "media_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "members" ADD CONSTRAINT "members_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revisions_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "revisions" ADD CONSTRAINT "revisions_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rules_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "rules" ADD CONSTRAINT "rules_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scenes_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "scenes" ADD CONSTRAINT "scenes_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'selected_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "selected" ADD CONSTRAINT "selected_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'versions_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "versions" ADD CONSTRAINT "versions_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'works_classId_fk' AND connamespace = 'harmony'::regnamespace) THEN
    ALTER TABLE "works" ADD CONSTRAINT "works_classId_fk" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
  END IF;
END $$;
REVOKE ALL ON SCHEMA harmony FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA harmony FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA harmony TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA harmony TO service_role;
-- No client RLS policies: only the server DB role can access student data.
COMMIT;
