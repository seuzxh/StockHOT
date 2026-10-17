export type StockMarket = "SH" | "SZ" | "BJ";

export interface SecurityIdentity {
  market: StockMarket;
  code: string;
  name: string;
  aliases: string[];
  subsidiaries?: string[];
}

export type SecurityMaster = readonly SecurityIdentity[];

export interface EvidenceInput {
  articleId: string;
  text: string;
}

export interface StockMention {
  articleId: string;
  market: StockMarket | null;
  code: string | null;
  name: string;
  evidence: string;
  relation: "explicit_code" | "unique_alias" | "subsidiary" | "inferred_beneficiary" | "ambiguous_name";
  status: "confirmed" | "pending";
  candidates: string[];
}

export const DEFAULT_SECURITY_MASTER: SecurityMaster = [
  { market: "SH", code: "600519", name: "贵州茅台", aliases: ["茅台"] },
  { market: "SZ", code: "300750", name: "宁德时代", aliases: ["CATL"], subsidiaries: [] },
  { market: "SH", code: "601318", name: "中国平安", aliases: [] },
  { market: "SH", code: "688981", name: "中芯国际", aliases: ["SMIC"] },
];

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termPattern = (term: string) => /^[a-z0-9]+$/i.test(term)
  ? new RegExp(`(?<![a-z0-9])${escape(term)}(?![a-z0-9])`, "iu")
  : new RegExp(escape(term), "iu");
const identity = (security: SecurityIdentity) => `${security.market}:${security.code}`;
const benefit = (text: string) => /受益|利好|有望|概念股|标的/u.test(text);

function evidenceFor(text: string, term: string): string {
  const sentence = text.split(/(?<=[。！？!?；;\n])/u).find((part) => part.includes(term))?.trim();
  return (sentence || text.trim()).slice(0, 600);
}

export function resolveStockMentions(input: EvidenceInput, master: SecurityMaster): StockMention[] {
  const mentions: StockMention[] = [];
  const resolved = new Set<string>();
  const codePattern = /(?<!\d)(?:(SH|SZ|BJ)[.\s:-]?)?(\d{6})(?!\d)(?:[.\s:-]?(SH|SZ|BJ))?/giu;

  for (const match of input.text.matchAll(codePattern)) {
    const market = (match[1] ?? match[3])?.toUpperCase() as StockMarket | undefined;
    const candidates = master.filter((security) => security.code === match[2] && (!market || security.market === market));
    if (candidates.length === 0 && market) {
      const key = `${market}:${match[2]}`;
      if (!resolved.has(key)) {
        resolved.add(key);
        mentions.push({
          articleId: input.articleId,
          market,
          code: match[2]!,
          name: match[2]!,
          evidence: evidenceFor(input.text, match[0]),
          relation: "explicit_code",
          status: "pending",
          candidates: [key],
        });
      }
      continue;
    }
    if (candidates.length !== 1) continue;
    const security = candidates[0]!;
    const key = identity(security);
    if (resolved.has(key)) continue;
    resolved.add(key);
    mentions.push({
      articleId: input.articleId,
      market: security.market,
      code: security.code,
      name: security.name,
      evidence: evidenceFor(input.text, match[0]),
      relation: "explicit_code",
      status: "confirmed",
      candidates: [key],
    });
  }

  const terms = new Map<string, Array<{ security: SecurityIdentity; subsidiary: boolean }>>();
  for (const security of master) {
    for (const term of [security.name, ...security.aliases]) {
      if (term.length < 2) continue;
      const list = terms.get(term) ?? [];
      list.push({ security, subsidiary: false });
      terms.set(term, list);
    }
    for (const term of security.subsidiaries ?? []) {
      const list = terms.get(term) ?? [];
      list.push({ security, subsidiary: true });
      terms.set(term, list);
    }
  }

  for (const [term, candidates] of [...terms].sort((a, b) => b[0].length - a[0].length)) {
    if (!termPattern(term).test(input.text)) continue;
    const available = candidates.filter(({ security }) => !resolved.has(identity(security)));
    if (!available.length) continue;
    const evidence = evidenceFor(input.text, term);
    const ids = [...new Set(available.map(({ security }) => identity(security)))];
    if (ids.length > 1) {
      mentions.push({ articleId: input.articleId, market: null, code: null, name: term, evidence, relation: "ambiguous_name", status: "pending", candidates: ids });
      continue;
    }
    const { security, subsidiary } = available[0]!;
    resolved.add(identity(security));
    const inferred = benefit(evidence);
    mentions.push({
      articleId: input.articleId,
      market: security.market,
      code: security.code,
      name: security.name,
      evidence,
      relation: inferred ? "inferred_beneficiary" : subsidiary ? "subsidiary" : "unique_alias",
      status: inferred || subsidiary ? "pending" : "confirmed",
      candidates: [identity(security)],
    });
  }

  return mentions;
}
