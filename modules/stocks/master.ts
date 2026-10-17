import { sql, type Db } from "@aihot/backend/db";
import { DEFAULT_SECURITY_MASTER, type SecurityIdentity, type SecurityMaster } from "./identity.ts";

export interface SecurityMasterSnapshot {
  version: string;
  effectiveFrom: Date;
  securities: readonly SecurityIdentity[];
}

export async function importSecurityMaster(snapshot: SecurityMasterSnapshot, db: Db = sql): Promise<number> {
  await db`UPDATE stock_security_master SET effective_to=${snapshot.effectiveFrom}
    WHERE effective_to IS NULL AND version<>${snapshot.version} AND effective_from<${snapshot.effectiveFrom}`;
  for (const security of snapshot.securities) {
    await db`INSERT INTO stock_security_master
      (market,code,name,aliases,subsidiaries,version,effective_from)
      VALUES (${security.market},${security.code},${security.name},${security.aliases},${security.subsidiaries ?? []},${snapshot.version},${snapshot.effectiveFrom})
      ON CONFLICT (market,code,version) DO UPDATE SET name=EXCLUDED.name,aliases=EXCLUDED.aliases,
        subsidiaries=EXCLUDED.subsidiaries,effective_from=EXCLUDED.effective_from`;
  }
  return snapshot.securities.length;
}

export async function loadSecurityMaster(at = new Date(), db: Db = sql): Promise<SecurityMaster> {
  const rows = await db<Array<SecurityIdentity & { effective_from: Date }>>`
    SELECT DISTINCT ON (market,code) market,code,name,aliases,subsidiaries,effective_from
    FROM stock_security_master
    WHERE effective_from<=${at} AND (effective_to IS NULL OR effective_to>${at})
    ORDER BY market,code,effective_from DESC`;
  return rows.length ? rows : DEFAULT_SECURITY_MASTER;
}

export async function securityMasterVersion(at = new Date(), db: Db = sql): Promise<string> {
  const [row] = await db<{ version: string }[]>`
    SELECT version FROM stock_security_master
    WHERE effective_from<=${at} AND (effective_to IS NULL OR effective_to>${at})
    ORDER BY effective_from DESC LIMIT 1`;
  return row?.version ?? "starter-v1";
}
