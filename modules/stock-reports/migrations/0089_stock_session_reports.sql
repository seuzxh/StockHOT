CREATE TABLE stock_session_reports (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('premarket', 'postmarket')),
  trading_date date NOT NULL,
  window_start timestamptz NOT NULL,
  cutoff_at timestamptz NOT NULL,
  calendar_version text NOT NULL,
  content jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, trading_date)
)
