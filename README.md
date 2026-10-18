# StockHOT

StockHOT 是个人 A 股资讯工作台。

它汇总公开资讯和授权数据。
它保留原文链接、原文时间和证据范围。
它支持盘前梳理、盘中跟踪和盘后复盘。

StockHOT 只提供资讯索引。
它不提供投资建议、交易信号或收益预测。

## 资讯来源

- 韭研公社：通过验证后启用。
- 同花顺：只通过 iFinD MCP 获取。

同花顺接入不使用网页采集。
iFinD 失败时，系统显示失败状态。
系统不会回退到同花顺网页。

## 技术基线

本项目基于 [AIHOT](https://github.com/KKKKhazix/AIHOT) 构建。
冻结的上游提交如下：

```text
84a7abb1d00a43a41e3ddcc26c45e1a23785e075
```

项目保留上游 MIT 许可和 NOTICE。
StockHOT 使用独立名称和品牌资源。

## 本地运行

环境要求：

- Node.js 24.11 或更高版本。
- PostgreSQL 17。
- Docker Compose 2。

复制示例配置：

```bash
cp .env.example .env
```

至少填写数据库和管理员配置。
需要模型处理时，再填写模型配置。
iFinD 默认关闭，令牌不得提交。

安装依赖并检查类型：

```bash
npm ci
npm run typecheck
```

启动服务：

```bash
docker compose up --build
```

网站默认地址为 `http://localhost:3000`。

## 文档

- [需求分析](docs/requirements-analysis.md)
- [产品需求](docs/product-requirements.md)
- [部署说明](docs/deploy.md)
- [上游定制说明](docs/customize.md)

## 许可

本项目沿用上游 MIT 许可。
详见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
