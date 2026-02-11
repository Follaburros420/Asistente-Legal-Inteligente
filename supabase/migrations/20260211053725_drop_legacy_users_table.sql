-- Drop legacy public.users table after runtime migration to auth.users + profiles.
-- Safety guard: abort if the table contains rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    PERFORM 1 FROM public.users LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Cannot drop public.users: table is not empty';
    END IF;

    DROP TABLE public.users;
  END IF;
END $$;
