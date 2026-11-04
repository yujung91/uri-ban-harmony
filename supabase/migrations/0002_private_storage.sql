-- Run only in the NEW Supabase project, after 0001. No public bucket/policies.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('harmony-media', 'harmony-media', false, 10485760)
ON CONFLICT (id) DO NOTHING;
-- Refuse an accidentally pre-existing public bucket rather than exposing files.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='harmony-media' AND public) THEN
    RAISE EXCEPTION 'harmony-media must be a new private bucket';
  END IF;
END $$;
-- No anon/authenticated object policies are added. All file reads go through
-- server APIs, which verify class/student ownership or explicit final selection.
COMMIT;
