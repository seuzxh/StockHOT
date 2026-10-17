CREATE TABLE stock_mention_scans (
  article_id text PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  article_revision integer NOT NULL,
  rule_version text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
