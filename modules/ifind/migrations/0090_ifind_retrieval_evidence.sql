CREATE TABLE ifind_query_runs (
  id text PRIMARY KEY,
  tool text NOT NULL,
  query_batch jsonb NOT NULL,
  status text NOT NULL,
  returned_count integer NOT NULL DEFAULT 0,
  eligible_count integer NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  error_kind text,
  created_at timestamptz NOT NULL DEFAULT now()
);
