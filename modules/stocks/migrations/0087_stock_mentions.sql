CREATE TABLE stock_mentions (
  id bigserial PRIMARY KEY,
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  article_revision integer NOT NULL,
  market text CHECK (market IN ('SH', 'SZ', 'BJ')),
  code text CHECK (code ~ '^[0-9]{6}$'),
  name text NOT NULL,
  evidence_text text NOT NULL,
  evidence_hash text NOT NULL,
  relation_type text NOT NULL CHECK (relation_type IN ('explicit_code', 'unique_alias', 'subsidiary', 'inferred_beneficiary', 'ambiguous_name')),
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('confirmed', 'pending')),
  candidate_ids text[] NOT NULL DEFAULT '{}',
  rule_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  withdrawn_at timestamptz,
  UNIQUE (article_id, article_revision, evidence_hash)
)
