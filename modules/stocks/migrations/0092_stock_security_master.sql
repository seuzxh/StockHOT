CREATE TABLE stock_security_master (
  market text NOT NULL CHECK (market IN ('SH', 'SZ', 'BJ')),
  code text NOT NULL CHECK (code ~ '^[0-9]{6}$'),
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  subsidiaries text[] NOT NULL DEFAULT '{}',
  version text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  PRIMARY KEY (market, code, version)
);
