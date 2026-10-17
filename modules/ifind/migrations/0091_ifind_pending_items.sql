CREATE TABLE ifind_pending_items (
  fingerprint text PRIMARY KEY,
  title text NOT NULL,
  snippet text NOT NULL DEFAULT '',
  url text,
  published_at timestamptz,
  publisher text,
  verification jsonb NOT NULL,
  query_batch jsonb NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
