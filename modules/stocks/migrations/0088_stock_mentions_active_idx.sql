CREATE INDEX CONCURRENTLY IF NOT EXISTS stock_mentions_active_idx ON stock_mentions (market, code, article_id) WHERE superseded_at IS NULL AND withdrawn_at IS NULL
