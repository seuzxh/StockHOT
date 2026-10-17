import { beijingDate, beijingTime } from "@aihot/contracts/time";
import { sql } from "@aihot/backend/db";
import { listedCondition } from "@aihot/backend/publication/scope";
import { classifyArrival, sessionWindow, type SessionKind, type SessionWindow } from "./windows.ts";

export interface SourceCoverage { id: string; available: boolean }
export interface ReportCandidate { articleId: string; title: string; publishedAt: Date | null; discoveredAt: Date }
export interface SessionReportContent {
  outcome: "highlights" | "no_highlights" | "incomplete";
  missingSources: string[];
  items: Array<{ articleId: string; title: string; publishedAt: string | null; discoveredAt: string; arrival: "late" | "on_time" }>;
}

export function buildSessionReport(window: SessionWindow, candidates: readonly ReportCandidate[], sources: readonly SourceCoverage[]): SessionReportContent {
  const missingSources = sources.filter((source) => !source.available).map((source) => source.id).sort();
  const items = candidates.flatMap((candidate) => {
    const arrival = classifyArrival(candidate.publishedAt, candidate.discoveredAt, window);
    return arrival === "outside" ? [] : [{
      articleId: candidate.articleId,
      title: candidate.title,
      publishedAt: candidate.publishedAt?.toISOString() ?? null,
      discoveredAt: candidate.discoveredAt.toISOString(),
      arrival,
    }];
  });
  return { outcome: missingSources.length ? "incomplete" : items.length ? "highlights" : "no_highlights", missingSources, items };
}

export async function publishSessionReport(window: SessionWindow, content: SessionReportContent): Promise<{
  created: boolean;
  report: { kind: string; tradingDate: string; cutoffAt: string; calendarVersion: string; generatedAt: string; content: SessionReportContent };
}> {
  const inserted = await sql`INSERT INTO stock_session_reports (kind,trading_date,window_start,cutoff_at,calendar_version,content)
    VALUES (${window.kind},${window.tradingDate},${window.start},${window.end},${window.calendarVersion},${sql.json(content as never)})
    ON CONFLICT (kind,trading_date) DO NOTHING RETURNING id`;
  const [row] = await sql<Array<{ kind: string; trading_date: string | Date; cutoff_at: Date; calendar_version: string; generated_at: Date; content: SessionReportContent }>>`
    SELECT kind,trading_date,cutoff_at,calendar_version,generated_at,content FROM stock_session_reports
    WHERE kind=${window.kind} AND trading_date=${window.tradingDate}`;
  if (!row) throw new Error("session report was not stored");
  const tradingDate = row.trading_date instanceof Date ? row.trading_date.toISOString().slice(0, 10) : String(row.trading_date);
  return { created: inserted.length === 1, report: { kind: row.kind, tradingDate, cutoffAt: row.cutoff_at.toISOString(), calendarVersion: row.calendar_version, generatedAt: row.generated_at.toISOString(), content: row.content } };
}

const SOURCE_IDS = ["jiuyangongshe", "robo-datayes", "ifind-news"];

export async function generateSessionReport(kind: SessionKind, tradingDate: string) {
  const window = sessionWindow(kind, tradingDate);
  if (!window) return { skipped: "not_trading_day" as const };
  const candidates = await sql<ReportCandidate[]>`
    SELECT DISTINCT p.article_id AS "articleId",p.title,a.published_at AS "publishedAt",a.discovered_at AS "discoveredAt"
    FROM publications p JOIN articles a ON a.id=p.article_id
    JOIN stock_mentions sm ON sm.article_id=p.article_id AND sm.superseded_at IS NULL AND sm.withdrawn_at IS NULL
    JOIN sources s ON s.id=p.source_id
    WHERE p.selected AND a.discovered_at>=${window.start} AND a.discovered_at<${window.end} AND ${listedCondition(window.end)}
    ORDER BY "discoveredAt","articleId"`;
  const rows = await sql<Array<{ id: string; enabled: boolean; last_ok_at: Date | null }>>`
    SELECT id,enabled,last_ok_at FROM sources WHERE id=ANY(${SOURCE_IDS})`;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const coverage = SOURCE_IDS.map((id) => ({ id, available: !!byId.get(id)?.enabled && !!byId.get(id)?.last_ok_at && byId.get(id)!.last_ok_at! >= window.start }));
  return publishSessionReport(window, buildSessionReport(window, candidates, coverage));
}

export async function generateDueSessionReport(kind: SessionKind, now = new Date()) {
  const date = beijingDate(now);
  const cutoff = kind === "premarket" ? "08:00" : "18:00";
  if (beijingTime(now) < cutoff) return { skipped: "before_cutoff" as const };
  return generateSessionReport(kind, date);
}
