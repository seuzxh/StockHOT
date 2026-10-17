# StockHOT V1 实施计划

> **执行要求：** 必须使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。执行者须逐项完成本计划。复选框用于记录进度。

**目标：** 基于 AIHOT 构建个人 A 股资讯工作台。完成验证后，将源码发布至 `seuzxh/StockHOT`。

**架构：** 保留 AIHOT 的 API、worker、web、发布、事件和报告链路。站点文案和金融分类放入 `site/` 与 `industry/`。新增 `ifind` 服务端模块。该模块负责定时调用 iFinD MCP。新增股票身份和证据模块。所有公开内容仍经过 AIHOT 发布层。

**技术栈：** Node.js 24.11+、TypeScript、React Router、Fastify、PostgreSQL 17、pg-boss、Docker Compose、Node test runner、iFinD MCP。

**需求文档：** `docs/product-requirements.md`、`docs/requirements-analysis.md`

## 全局约束

- 使用 AIHOT 提交 `84a7abb1d00a43a41e3ddcc26c45e1a23785e075`。
- 该提交是冻结的开发基线。
- 同花顺资讯只使用 iFinD MCP/skill。
- 禁止回退到同花顺网页采集。
- 保留原文链接和原文时间。
- 保留发现时间和证据范围。
- iFinD 返回片段只能视为片段。
- 不得将片段表述为全文。
- 不生成交易信号和收益预测。
- 不生成股票买卖建议。
- 凭据只保存在服务端。
- 禁止提交 `.env`、令牌和 `.data/`。
- 页面请求不得调用模型。
- 模型只在 worker 任务中调用。
- 所有公开出口共用发布层。
- 展示和排程使用北京时间。

## 审查重点

- iFinD 无结果、额度错误和凭据失效必须分开显示。任何状态都不得触发网页回退。
- iFinD 重复返回片段时，入库必须幂等。重复内容不得增加来源数。
- 公司名称存在歧义时，不得确认股票代码。系统必须保留待确认状态。
- 旧资讯迟到时，只能归档或标记迟到。系统不得改写历史报告。
- 来源超时或单次返回 404 时，只能标记暂不可用。系统不得自动判定撤回。

## 需求覆盖

| 需求 | 负责任务 |
|---|---|
| R01 三个来源 | 任务 3、4、8 |
| R02 统一资讯流 | 任务 2、4、6 |
| R03 原始披露入口 | 任务 2、4、6 |
| R04 带引用摘要 | 任务 2、3、6 |
| R05 事件聚合 | 任务 2、4、6 |
| R06 股票关联 | 任务 5 |
| R07 个人关注 | 任务 6 |
| R08 盘前与盘后报告 | 任务 7 |
| R09 重点排序 | 任务 2 |
| R10 搜索与历史回看 | 任务 6 |
| R11 来源状态 | 任务 4、6、8 |
| R12 更正与撤回 | 任务 5、6 |
| R13 成本与访问边界 | 任务 3、4、6、9 |

---

### Task 1：建立 AIHOT 基线和仓库身份

**文件：**

- 导入：冻结提交中的上游仓库
- 保留：`docs/requirements-analysis.md`
- 保留：`docs/product-requirements.md`
- 修改：`package.json`
- 修改：`README.md`
- 修改：`.env.example`

**接口：**

- 输入：冻结的 AIHOT 源码和需求文档。
- 输出：可构建的 StockHOT 仓库。仓库保留上游来源说明。仓库不包含凭据。

- [x] **步骤 1：添加仓库身份失败测试**

创建 `tests/stockhot-identity.standalone.test.ts`。测试须检查包名、README 标题和示例配置。读者侧品牌必须使用 StockHOT。不得复用 AIHOT 名称和 Logo。

- [x] **步骤 2：运行测试并确认失败**

运行：`docker run --rm -v "$PWD:/app" -w /app node:24.11-bookworm npm run test:standalone -- --test-name-pattern="StockHOT identity"`

预期：测试失败。

- [x] **步骤 3：导入冻结源码并设置仓库身份**

保留上游 MIT 许可。将包名改为 `stockhot`。替换读者可见的项目说明。记录冻结提交号。

- [x] **步骤 4：添加 iFinD 环境变量名**

在 `.env.example` 添加 `IFIND_MCP_AUTH_TOKEN`、`IFIND_MCP_BASE_URL`、`IFIND_NEWS_ENABLED` 和 `IFIND_NEWS_INTERVAL_MINUTES`。示例不得包含真实凭据。功能默认关闭。

- [x] **步骤 5：重新运行身份测试**

预期：测试通过。

- [x] **步骤 6：提交变更**

提交信息：`chore: establish StockHOT baseline`

### Task 2：定制金融站点和精选契约

**文件：**

- 修改：`site/site.ts`
- 修改：`site/pages/terms.md`
- 修改：`site/pages/privacy.md`
- 修改：`site/public/*`
- 替换：`industry/taxonomy.ts`
- 替换：`industry/topics.json`
- 替换：`industry/sources.json`
- 修改：`industry/selection.ts`
- 修改：`industry/prompts/*.md`
- 修改：`industry/wording.ts`
- 测试：`tests/stockhot-industry.standalone.test.ts`

**接口：**

- 输入：AIHOT 站点与行业配置契约。
- 输出：`SITE`、金融分类、主题、来源和提示词。

- [x] **步骤 1：编写配置失败测试**

测试须检查站名、`stockhot` MCP 前缀、A 股分类、风险中性文案和三个来源。分类中不得保留 AI 示例。

- [x] **步骤 2：运行定向测试并确认失败**

- [x] **步骤 3：实现站点身份和规则文案**

首版暂用 StockHOT 名称。明确网站是资讯索引。明确内容不构成投资建议。默认关闭站内全文。

- [x] **步骤 4：实现金融分类和主题**

分类包含市场、行业、政策、公司事件、公告、研究、风险和社区线索。股票主题使用稳定证券身份。显示名称不得作为唯一身份。

- [x] **步骤 5：实现金融提示词**

提示词必须分开事实和观点。保留“拟”和“预计”等限定词。优先追溯原始来源。语言保持中性。没有证据时不得推断受益股票。

- [x] **步骤 6：配置初始来源**

韭研公社和萝卜投研先设为未验证或停用。通过实时预览后才能启用。iFinD 外部来源在凭据验证前停用。禁止配置同花顺网页来源。

- [x] **步骤 7：运行配置和分类测试**

预期：全部定向测试通过。

- [x] **步骤 8：提交变更**

提交信息：`feat: customize StockHOT financial domain`

### Task 3：添加 iFinD MCP 客户端和结果标准化

**文件：**

- 创建：`modules/ifind/package.json`
- 创建：`modules/ifind/client.ts`
- 创建：`modules/ifind/types.ts`
- 创建：`modules/ifind/normalize.ts`
- 创建：`modules/ifind/tests/client.standalone.test.ts`
- 创建：`modules/ifind/tests/normalize.standalone.test.ts`

**接口：**

- 输入：`IFIND_MCP_AUTH_TOKEN`、MCP JSON-RPC 和三种新闻工具。
- 工具：`search_news`、`search_notice`、`search_trending_news`。
- 输出：`callIfind(tool: IfindNewsTool, args: IfindArgs, transport?: Transport): Promise<IfindCallResult>`。
- 输出：`normalizeIfindResult(input: unknown, batch: QueryBatch): NormalizedIfindItem[]`。

- [x] **步骤 1：编写传输层测试**

覆盖初始化、会话头、工具白名单、超时、额度错误、凭据失效和异常 JSON-RPC。测试必须证明没有网页回退。

- [x] **步骤 2：运行传输层测试并确认失败**

- [x] **步骤 3：实现最小 MCP 客户端**

只调用 iFinD 新闻 MCP 地址。错误和日志不得包含授权令牌。

- [x] **步骤 4：编写标准化测试**

覆盖完整元数据、仅片段结果、缺失链接、缺失时间、重复片段、稳定标识和异常响应结构。

- [x] **步骤 5：实现结果标准化**

结果包含标题、可追溯链接、发布时间、时间精度、片段、原始发布方、查询批次、外部标识或内容指纹，以及核验状态。

- [x] **步骤 6：运行模块测试**

预期：测试通过。测试不得访问网络。

- [x] **步骤 7：提交变更**

提交信息：`feat: add iFinD news client`

### Task 4：定时获取 iFinD 资讯并幂等入库

**文件：**

- 创建：`modules/ifind/collector.ts`
- 创建：`modules/ifind/server.ts`
- 创建：`modules/ifind/queries.ts`
- 创建：`modules/ifind/tests/collector.test.ts`
- 修改：`site/modules/server.ts`
- 修改：`site/modules/index.ts`
- 修改：`packages/backend/src/ingest/items.ts`
- 修改：`tests/ingest.test.ts`

**接口：**

- 输入：`callIfind`、`normalizeIfindResult`、AIHOT `Scheduled` 和 `ingestItems`。
- 输出：`collectIfindNews(now: Date): Promise<IfindRunSummary>`。
- 输出：安装到站点的服务端排程。

- [x] **步骤 1：编写采集器测试**

测试固定查询主题、滚动时间窗、50 条分批、外部标识幂等和原始出处。空结果、额度错误和凭据错误必须分开。测试须确认没有同花顺网页请求。

- [x] **步骤 2：运行采集器测试并确认失败**

- [x] **步骤 3：扩展外部入库元数据**

保留外部标识、通道、原始发布方、片段范围、查询参数和追溯状态。任何字段不得暴露凭据。

- [x] **步骤 4：实现定时采集器**

通过 `site/modules/server.ts` 安装模块。只有 `COLLECT_ENABLED=true`、`IFIND_NEWS_ENABLED=true` 且令牌有效时才运行。使用现有任务记录机制保存每次运行。

- [x] **步骤 5：运行采集和入库测试**

预期：使用模拟 MCP 和测试数据库时通过。

- [x] **步骤 6：提交变更**

提交信息：`feat: ingest scheduled iFinD news`

### Task 5：添加股票身份和证据关联

**文件：**

- 创建：`modules/stocks/package.json`
- 创建：`modules/stocks/identity.ts`
- 创建：`modules/stocks/evidence.ts`
- 创建：`modules/stocks/server.ts`
- 创建：`modules/stocks/migrations/0056_stock_mentions.sql`
- 创建：`modules/stocks/tests/identity.standalone.test.ts`
- 创建：`modules/stocks/tests/association.test.ts`
- 修改：`site/modules/server.ts`
- 修改：`site/modules/index.ts`

**接口：**

- 输入：标准化文章、A 股证券主数据和处理钩子。
- 输出：`resolveStockMentions(input: EvidenceInput, master: SecurityMaster): StockMention[]`。
- 存储：市场、代码、名称、证据文本、关系类型和确认状态。

- [x] **步骤 1：编写身份识别测试**

覆盖明确代码、唯一别名、同名歧义、母子公司混淆、只有题材的内容，以及推断受益表述。

- [x] **步骤 2：运行身份测试并确认失败**

- [x] **步骤 3：实现主数据导入和确定性匹配**

证券身份使用市场和代码。模型推断的受益关系不得自动确认。

- [x] **步骤 4：编写持久化测试**

测试证据文本、来源文章、规则版本、更正行为和撤回可见性。

- [x] **步骤 5：实现处理钩子和迁移**

股票能力保留在模块边界内。除现有钩子契约外，不在通用引擎中加入股票逻辑。

- [x] **步骤 6：运行模块、迁移和架构测试**

- [x] **步骤 7：提交变更**

提交信息：`feat: add evidence-backed stock associations`

### Task 6：添加股票页面、关注筛选和来源状态

**文件：**

- 创建：`modules/stocks/module.ts`
- 创建：`modules/stocks/web.tsx`
- 创建：`modules/stocks/api/routes.ts`
- 创建：`modules/stocks/backend/publication.ts`
- 创建：`modules/stocks/tests/publication.test.ts`
- 创建：`modules/stocks/tests/routes.standalone.test.ts`
- 修改：`site/modules/web.ts`
- 修改：`site/modules/index.ts`
- 修改：`apps/web/app/app.css`

**接口：**

- 输入：已确认的股票关联和发布范围结果。
- 输出：股票页、题材页和本机关注列表。
- 输出：关注筛选和来源状态数据。

- [x] **步骤 1：编写发布范围测试**

撤回内容必须消失。临时失败不得视为撤回。冲突主张必须分开。未确认的股票匹配必须标记。

- [x] **步骤 2：运行测试并确认失败**

- [x] **步骤 3：实现股票发布读取和路由**

所有读取经过发布层。每个关联须返回证据和出处。

- [x] **步骤 4：实现关注列表界面**

关注列表保存在本机。它与收藏事件分开。支持 JSON 导出和导入。筛选不得改变置信度或排序。

- [x] **步骤 5：实现来源状态界面**

界面须区分无新增、采集延迟、iFinD 无结果、额度耗尽、凭据失效和报告覆盖不完整。

- [x] **步骤 6：运行路由、前端构建和无障碍检查**

- [x] **步骤 7：提交变更**

提交信息：`feat: add stock watchlist workspace`

### Task 7：添加盘前和盘后报告契约

**文件：**

- 创建：`modules/stock-reports/server.ts`
- 创建：`modules/stock-reports/windows.ts`
- 创建：`modules/stock-reports/tests/windows.standalone.test.ts`
- 创建：`modules/stock-reports/tests/reports.test.ts`
- 修改：`site/modules/server.ts`
- 修改：`site/modules/index.ts`

**接口：**

- 输入：已发布事件、来源状态、交易日历和报告接口。
- 输出：不可变的盘前和盘后报告。
- 报告包含截止时间、迟到标记和缺失来源。

- [ ] **步骤 1：编写时间窗口测试**

覆盖周末、法定节假日、长假后首个交易日、08:00 和 18:00 截止点、迟到资讯和重叠阅读窗口。

- [ ] **步骤 2：运行测试并确认失败**

- [ ] **步骤 3：实现交易日窗口**

使用带版本的交易日历文件。不得用工作日直接替代交易日。

- [ ] **步骤 4：编写报告测试**

“没有新增重点”和“来源缺失”必须分开。历史报告不得静默变化。

- [ ] **步骤 5：实现报告排程和不可变报告数据**

- [ ] **步骤 6：运行报告和排程退役测试**

- [ ] **步骤 7：提交变更**

提交信息：`feat: add market-session reports`

### Task 8：验证实时来源适配器并失败关闭

**文件：**

- 创建：`docs/source-validation.md`
- 创建：`tests/fixtures/sources/jiuyangongshe/*`
- 创建：`tests/fixtures/sources/robo-datayes/*`
- 修改：`industry/sources.json`
- 测试：现有来源解析和列表测试

**接口：**

- 输入：允许访问的实时端点和脱敏样本。
- 输出：只有通过五个交易日验证的来源才启用。其他来源保持明确停用状态。

- [ ] **步骤 1：记录允许的访问路径和预期字段**

- [ ] **步骤 2：添加解析样本和失败测试**

- [ ] **步骤 3：实现最小来源配置或适配器**

不得绕过登录、付费墙、robots 规则或访问限制。

- [ ] **步骤 4：运行预览并记录证据**

记录标题、链接、时间、分页和重复结果。

- [ ] **步骤 5：保持未验证来源停用**

正式完成三源接入需要实时验收。范围变化必须由用户明确批准。

- [ ] **步骤 6：提交变更**

提交信息：`feat: validate StockHOT source adapters`

### Task 9：完成验证、部署冒烟和 GitHub 发布

**文件：**

- 修改：`docs/deploy.md`
- 创建：`docs/verification.md`
- 创建：`.github/workflows/ci.yml`

**接口：**

- 输入：完整仓库和安全的测试凭据。
- 输出：可复现的验证证据。
- 输出：GitHub 仓库 `seuzxh/StockHOT`。

- [ ] **步骤 1：运行静态和独立测试**

使用 Node.js 24.11+ 运行 `npm ci`、`npm run typecheck`、`npm run test:standalone` 和 `npm run build -w @aihot/web`。

- [ ] **步骤 2：运行 PostgreSQL 测试**

测试数据库名称必须以 `_test` 结尾。运行完整 `npm test`。

- [ ] **步骤 3：运行 Docker Compose 冒烟测试**

使用本地随机凭据。模型和 iFinD 使用模拟服务。运行 `node scripts/smoke.ts --base http://localhost:3000`。

- [ ] **步骤 4：运行 iFinD 实际能力验证**

使用用户授权的凭据。先直接调用新闻工具。只有工具缺失或权限不符时，才列出工具。查询窄时间窗。核对可追溯字段。验证后删除临时输出。

- [ ] **步骤 5：完成逐项验收审计**

将 R01 至 R13、A01 至 A27 映射到测试或运行证据。未解决项必须明确记录。必要来源未验证时，不得宣称正式完成。

- [ ] **步骤 6：添加 CI 和验证记录**

CI 不得需要真实凭据。CI 不得访问外部服务。

- [ ] **步骤 7：创建并推送 GitHub 仓库**

所有必需检查通过后，创建 `seuzxh/StockHOT`。推送已验证的默认分支。远端提交必须与本地 `HEAD` 一致。

- [ ] **步骤 8：核对 GitHub 状态**

回读仓库可见性、默认分支、最新提交和 CI 状态。单独报告实时数据限制。
