# vexuni

**简体中文** · [English](README.en.md)

**一个小而美的代码托管平台，运行在 Cloudflare 之上。**

托管代码、管理团队、审阅变更——像 GitLab / Gogs 一样工作，却不需要服务器、Docker 或容器。Git 服务由纯 JavaScript 在 Workers 中实现，所有数据保存在你自己的 Cloudflare 账号里。

[部署指南](docs/DEPLOYMENT.md) · [架构设计](docs/ARCHITECTURE.md) · [使用边界](docs/LIMITS.md) · [版本记录](docs/CHANGELOG.md)

---

## 能做什么

| 能力 | 说明 |
| --- | --- |
| **代码托管** | 公开 / 私有仓库，HTTPS clone、push、fetch，分支、标签、Fork、Git LFS 与上游同步 |
| **代码浏览** | 语法高亮、文件历史、Diff、Blame、跨项目搜索，Markdown / 图片 / Jupyter Notebook 预览 |
| **团队协作** | 多工作空间、角色权限、Issue / 看板 / 里程碑、合并请求、行级讨论、CODEOWNERS、受保护分支 |
| **CI/CD** | 推送与定时触发、日志、变量 / 密钥、缓存与产物；云端构建 TS / TSX、JS / CSS 及锁定 npm 依赖，支持应用发布与回滚 |
| **项目管理** | npm / 通用包仓库、版本发布、Wiki、通知、审计日志、管理员后台 |
| **账户与集成** | 访问令牌、双重验证、OAuth / OIDC 登录、Webhook、REST API、MCP，TypeScript / Python / Go SDK |
| **语言** | 简体中文 / English 界面与文档，保存语言偏好 |

## 如何运行

一个完整实例由三个 Worker 组成：**主服务**处理 Git、网页与 API；**编译服务**用 WASM 构建代码；**应用网关**在独立域名提供已发布的应用。

| Cloudflare 服务 | 用途 |
| --- | --- |
| Workers + Static Assets | 网页、鉴权、Git HTTPS 协议与 API |
| Durable Objects | 按仓库协调写入，原子更新分支 / 标签引用 |
| R2 | Git 对象、LFS、包文件、构建产物与缓存 |
| D1 | 用户、权限、协作内容、搜索索引与任务状态 |
| Queues + Cron + DO Alarms | 后台任务、事件投递、重试与清理 |
| Worker Loader + WASM | 隔离执行云端任务、编译与应用运行 |

一次推送的主要路径：**Git 客户端 → 主 Worker 校验权限 → 仓库 DO 协调 → R2 保存对象 → DO 原子发布引用**。索引、CI 与通知由后台任务处理。

## 部署到 Cloudflare

1. 在 `wrangler.jsonc` 中设置 `APP_ORIGIN`（规范地址）与 `APPS_ORIGIN`（应用网关地址），并填入你自己的 D1 `database_id`。
2. 配置 `BOOTSTRAP_SECRET` 与 `CREDENTIAL_ENCRYPTION_KEY` 两个 Worker secret。
3. 执行 `npm run deploy`，依次部署编译服务、应用网关与主服务；使用初始化密钥调用 `POST /api/setup` 创建管理员。普通用户使用通行密钥注册。

数据库迁移、资源绑定与服务地址的连接方式详见 [部署说明](docs/DEPLOYMENT.md)。已有实例升级请保留原有资源和加密密钥。

## 本地体验

需要 Node.js 22.13+ 与 npm：

```sh
git clone https://github.com/vexuni/vexuni.git
cd vexuni
npm ci
npm run dev
```

打开 [localhost:8787](http://localhost:8787)，使用初始化密钥 `local-development-only-change-me` 调用 `POST /api/setup` 创建管理员，密码至少 12 个字符。此密钥仅供本地开发；Git HTTPS 认证使用个人访问令牌（PAT）作为密码。

## 使用范围

云端 CI 运行 JS / WASM，不执行任意 shell、Python 或 npm 生命周期脚本；通用命令构建可接入自行管理的外部 Runner。暂不支持 SSH Git 传输、shallow / partial clone，也不完整兼容 GitLab API。容量与仓库规模边界见 [使用边界](docs/LIMITS.md)。

## 文档

[部署与恢复](docs/DEPLOYMENT.md) · [CI/CD](docs/CI-BUILDS-v22.md) · [API](docs/API.md) · [SDK](docs/SDK.md) · [贡献指南](CONTRIBUTING.md) · [安全说明](SECURITY.md)

---

采用 [AGPL-3.0-only](LICENSE) 开源协议：修改后通过网络提供服务时，须向用户提供相应源码。vexuni 与 GitLab、Gogs 或 Cloudflare 无隶属关系。
