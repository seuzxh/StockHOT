// StockHOT 的稳定分类、标签和首批证券身份。

export const CATEGORIES = [
  { key: "market", label: "市场", section: "市场与资金", guide: "指数、成交、市场制度和全市场状态。单家公司事项不归入本类。" },
  { key: "industry", label: "行业", section: "行业与题材", guide: "行业供需、价格、产业链和可核验的题材变化。" },
  { key: "policy", label: "政策", section: "政策与监管", guide: "已发布的政策、监管决定和规则变化。传闻不得归为正式政策。" },
  { key: "company", label: "公司事件", section: "公司事件", guide: "上市公司的经营、合同、并购、人事和诉讼等具体事件。" },
  { key: "notice", label: "公告", section: "公司公告", guide: "交易所或上市公司正式披露的公告。保留拟、预计等阶段限定。" },
  { key: "research", label: "研究", section: "研究与数据", guide: "机构研究、行业数据和公司调研。观点不得改写为已发生事实。", commentary: true },
  { key: "risk", label: "风险", section: "风险提示", guide: "处罚、立案、违约、减值、退市及其他已披露风险。" },
  { key: "community", label: "社区线索", section: "社区线索", guide: "社区讨论和待核验线索。没有原始来源时不得确认事实。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

export const RELEASE: { category: string; tag: string; unit: string } | null = null;

export const PLAIN_TERMS: readonly string[] = ["a股", "沪深北", "ipo", "etf"];

export const ITEM_TYPES = ["disclosure", "news", "research", "opinion", "market_signal"] as const;

export const CATEGORY_TAGS = [
  "市场动态", "行业动态", "政策监管", "公司事件", "公司公告", "研究数据", "风险事件", "社区线索", "其他",
] as const;

export const TOPIC_TAGS = [
  "沪深300", "中证1000", "上证50", "新能源", "半导体", "人工智能", "医药", "消费", "金融", "周期", "并购重组", "业绩", "分红", "减持",
] as const;

export const ENTITY_TAGS = ["贵州茅台", "宁德时代", "中国平安", "中芯国际"] as const;

export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  公告: "公司公告", 披露: "公司公告", 监管: "政策监管", 政策: "政策监管",
  风险: "风险事件", 处罚: "风险事件", 研究: "研究数据", 研报: "研究数据",
  公司: "公司事件", 行业: "行业动态", 市场: "市场动态", 题材: "行业动态", 传闻: "社区线索",
};

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; otherNames?: string[] }> = {
  "sh-600519": { name: "贵州茅台", displayTag: "贵州茅台", aliases: ["贵州茅台", "600519", "SH600519"] },
  "sz-300750": { name: "宁德时代", displayTag: "宁德时代", aliases: ["宁德时代", "300750", "SZ300750", "CATL"] },
  "sh-601318": { name: "中国平安", displayTag: "中国平安", aliases: ["中国平安", "601318", "SH601318"] },
  "sh-688981": { name: "中芯国际", displayTag: "中芯国际", aliases: ["中芯国际", "688981", "SH688981", "SMIC"] },
};

export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "sh-600519", name: "贵州茅台", patterns: [/贵州茅台|SH?600519/i] },
  { id: "sz-300750", name: "宁德时代", patterns: [/宁德时代|SZ?300750|\bCATL\b/i] },
  { id: "sh-601318", name: "中国平安", patterns: [/中国平安|SH?601318/i] },
  { id: "sh-688981", name: "中芯国际", patterns: [/中芯国际|SH?688981|\bSMIC\b/i] },
];

export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [];

export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
