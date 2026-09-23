# 部署 vexuni

**简体中文** · [English](en/DEPLOYMENT.md)

## 实例构成

每个 vexuni 实例由三个 Worker 与一组存储资源组成：主 Worker `vexuni` 处理网页、鉴权、Git HTTPS 与 API；私有编译 Worker `vexuni-build` 用 WASM 执行构建；独立 `vexuni-apps` 网关在单独域名提供已发布的应用。数据面包括 D1 `vexuni`（元数据）、R2 `vexuni-objects` 与 `vexuni-npm-cache`（对象与缓存）、Queue `vexuni-events`（后台事件）和 SQLite Durable Object 类 `Repository`。没有 Containers、Docker 镜像或外部 Git 服务器。

规范地址由 `APP_ORIGIN` 指定，浏览器登录和 LFS 都应使用该地址。迁移旧域名时可设置可选变量 `LEGACY_APP_ORIGIN`：仅旧域名的网页 GET/HEAD 请求重定向到规范地址，原生 Git 和 API 请求不重定向。OIDC/OAuth 回调应指向 `<APP_ORIGIN>/api/auth/oidc/callback`。

首次初始化通过网页完成，用户名和密码由操作者选择，并需提供部署时的初始化密钥。初始化 secret 存放在本机被 Git 忽略的 `.data/production-bootstrap-secret.txt`（权限 0600），同时保存在 Worker secret 中。不要将它加入源码或公开发送。成功创建管理员后，D1 会锁定初始化，可删除云端 BOOTSTRAP_SECRET。普通用户使用通行密钥注册，只能成为普通用户。

## 主域名与语言

切换主域名时，新旧域名可同时绑定到同一主 Worker；浏览器需在新主域名重新登录，OIDC/OAuth 回调域名随之更新。仓库 UUID、D1、R2、DO 与加密密钥保持不变。

平台支持简体中文和英文，语言菜单保存本机偏好；首次访问按浏览器语言协商，可用 `?lang=en` 或 `?lang=zh-CN` 指定。文档入口 `/docs` 跳转到所选语言，文档页可切换对应译文。代码、文件名、Issue 正文和其他用户内容不翻译。

## 从源码部署新的实例

需要 Cloudflare 账号、Workers、D1、R2、SQLite Durable Objects、Queues 可用，并有对应额度；Node.js 22.13+ 和 npm。无需 Docker 或服务端 Git。资源使用会产生相应费用，配额取决于账号计划。

```sh
npm ci
npx wrangler login
npx wrangler whoami
npx wrangler d1 create vexuni
npx wrangler r2 bucket create vexuni-objects
npx wrangler r2 bucket create vexuni-npm-cache
npx wrangler queues create vexuni-events
```

这些 create 命令仅用于新实例；当前实例的资源已存在，不能重复创建。将返回的数据库 UUID 填入 `wrangler.jsonc` 和 `wrangler.apps.jsonc`，两个配置的 `DB` / `OBJECTS` 必须指向本实例的同一数据库和 Git 对象桶。编译配置 `wrangler.build.jsonc` 的 `NPM_CACHE` 指向独立 npm 缓存桶，缓存清理配置见 [npm 缓存](CI-NPM-CACHE-v35.md)。

资源同名冲突时选择独立名称。替换 APP_ORIGIN 及自定义域名 route，不能覆盖其他服务。若仅使用 workers.dev，移除 routes 并将 APP_ORIGIN 改为实际 Worker URL。逻辑 binding 名 `DB`、`OBJECTS`、`REPOSITORIES`、`EVENTS` 保持不变。

```sh
npm run check
npm run build:production
npm run build:compiler
npm run db:remote
npm run deploy:build
npm run deploy:apps
# 将返回的应用网关 URL 写入主配置 APPS_ORIGIN，再部署主服务
npm run deploy
npx wrangler secret put BOOTSTRAP_SECRET
npx wrangler secret put CREDENTIAL_ENCRYPTION_KEY
```

先部署编译 Worker 和应用网关，最后部署主 Worker；主配置的 `BUILDER` 服务名必须与 `wrangler.build.jsonc` 的 Worker 名一致。编译 Worker 仅绑定公共 npm 缓存桶 `NPM_CACHE`，不绑定 Git 数据库、Git 对象桶或登录密钥，禁用 workers.dev 和预览 URL。升级它无需 D1 迁移。详见 [云端构建](CI-BUILDS-v22.md)。

应用网关的 `wrangler.apps.jsonc` 保留 `LOADER`。把主 Worker 的 `APPS_ORIGIN` 设置为 `npm run deploy:apps` 返回的独立应用域名，然后发布主 Worker。应用域名须与 Git 登录域名分开。

`deploy` 与打包命令会先从明确的源码目录生成 `public/source.tar.gz`，通过页面提供 AGPL 源码下载。不要将私有文件放入这些源码目录；`.data`、`.wrangler` 和环境密钥文件不在打包白名单。

为 BOOTSTRAP_SECRET 使用至少 32 字节的随机值，在 Wrangler 提示中输入。未配置密钥时初始化接口拒绝创建管理员；通行密钥注册保持开放，且始终只创建普通用户。生产不能使用 `wrangler.local.jsonc`；它含公开的本地测试密钥。不要导入本地 `.wrangler` 数据。

访问 `/api/health`，确认 HTTPS 与静态页面可用，然后初始化管理员、创建私有验收项目和临时 PAT，执行真实 push、clone、fetch、merge 与 LFS。验证后撤销验收凭证。公开 DNS 和本地负缓存传播可能有时间差；不要为排查 DNS 而关闭 TLS 校验。

## 自动部署

仓库内置 `.github/workflows/deploy.yml`：构建前端、文档与源码包；幂等创建 D1、两个 R2 桶与事件队列；应用远程 D1 migrations；写入 Worker secrets；依次部署编译 Worker、应用网关与主 Worker；绑定配置的自定义域名并完成冒烟验证。改动涉及可部署代码时推送到 `main` 自动执行，也可手动触发。

需要的仓库 secrets：`CLOUDFLARE_API_TOKEN`（需具备 Workers Scripts、D1、R2、Queues 与 Workers Domains 权限）、`BOOTSTRAP_SECRET`、`CREDENTIAL_ENCRYPTION_KEY`。生成两个独立随机值：`BOOTSTRAP_SECRET` 用 `openssl rand -hex 32`，`CREDENTIAL_ENCRYPTION_KEY` 用 `openssl rand -base64 32`。前者用于网页首次初始化，后者用于加密凭据，必须妥善保管且升级时保持不变。

Worker 名使用 2–50 个小写字母、数字或连字符，以字母开头、以字母或数字结尾；为衍生的 `<名称>-build` 与 `<名称>-apps` 预留空闲名称。新实例不要复用已有实例的资源。首次使用需启用相关服务与额度，费用按实际资源使用计费。失败不会删除已有数据；修复配置后重新部署即可，自动清理未完成实例需另行操作。

## 更新与迁移

升级前先应用待执行的编号 SQL migration，再发布主 Worker；应用网关与编译 Worker 仅在自身代码变化时需要重新部署。现有项目变量、会话与运行快照保持兼容，必须保留 `CREDENTIAL_ENCRYPTION_KEY`。管理员在 `/admin/identity` 配置 OIDC 提供方，回调为 APP_ORIGIN 加 `/api/auth/oidc/callback`；详见 [统一登录](OIDC-v23.md)。

保持 Worker 名、DO 类名、migration 历史、D1 UUID 和仓库 UUID 映射稳定。先备份并在独立环境验证，再应用新的编号 SQL migration 和部署。由旧快照部署的实例须保留已应用的 DO migration 记录，并制定被取代类的退役 migration；不能直接重写历史。

旧 `snapshot` 指针存在、`refs.v2` 尚不存在时，首次请求会在 Worker 内解析 tar，导入 Git 对象到 R2，再原子提交 refs。兼容 macOS AppleDouble 元数据。旧快照不会被删，但迁移后的新写入不会同步回旧快照，因此直接回滚旧引擎会丢失新版本可见的更新。超出新引擎预算的旧仓库需要离线迁移方案；不要初始化空仓库掩盖导入失败。

## Webhook

默认 `WEBHOOK_ALLOWED_HOSTS` 为空，不对外投递。操作者可配置逗号分隔的可信 HTTPS 接收端主机名，例如 `build.example.net,hooks.example.net`。接收端必须由你信任和管理，不使用任意租户可控 DNS 或内部地址。

维护者通过 API 创建 `{url}`，得到一次性显示的签名 secret。事件仅包含事件名、仓库 UUID、actor、detail 和时间，不含代码或凭证。操作记录与 outbox 在 D1 同一 batch；Queue 调用失败由五分钟 Cron 补发。投递最多五次，失败状态可通过 deliveries API 查询。接收端校验时间戳/HMAC，并以 `X-vexuni-Delivery` 去重。

Git ref 与 push 事件现在在 DO 中原子写入，再由 alarm 幂等投影至 D1 outbox。接收端仍需处理重复/延迟，并定期比较 refs；协作元数据与 Git 不是分布式事务。

## 运行与成本

- APP_ORIGIN 必须与浏览器规范地址一致，影响 Cookie 写操作和 LFS action URL。
- 公开注册以通行密钥为先：`POST /api/webauthn/register/*` 在选择用户名之前先验证 WebAuthn attestation。Relying Party ID 默认取 APP_ORIGIN 主机名去掉 `www.` 前缀；可用 `WEBAUTHN_RP_ID` 覆盖，`WEBAUTHN_ORIGINS`（逗号分隔）可追加开发服务器等额外来源。
- 每仓库一个 DO，最多 16 个请求排队；操作串行执行。没有 Container 实例数/启动延迟。
- R2 逐对象保存 canonical 数据；传输时重新生成 pack。每次请求的 R2 读取数量和历史大小会影响延迟与成本。
- 应用限额见 [使用边界](LIMITS.md)；Worker/DO CPU、内存、子请求等平台限额仍独立生效。大仓库尚不适用。
- 删除整个仓库会通过 DO alarm 清理对象；活跃仓库没有不可达对象 GC 或总存储配额。
- 监控 Worker 错误、DO 请求饱和、R2 用量和缺失对象、D1/Queue 失败。不要把成功健康检查视为持久化或恢复测试。

## 备份和恢复

必须同时备份 D1、R2 的 `repos/` 和 `lfs/`、每个仓库 DO 的 `refs.v2`（以及尚未迁移的 `snapshot`）。**仅备份 R2 无法恢复全部引用与账号。** 当前没有跨服务一致性备份、一键全站恢复或 refs 导出管理工具；生产灾难恢复仍需实现并演练。

- Worker 重启：正常请求从 DO 读取 refs、从 R2 读取对象，无需缓存恢复脚本。
- 缺失已引用对象：恢复相应 R2 canonical 对象，不能提交空 refs。
- 误删：停止该仓库写入，从一致备份恢复必要组件。
- 不为 Git 对象配置盲目到期策略。任何 GC 必须先枚举可靠的活动 refs、计算可达性，并设置保留期和并发保护。

## 上游同步与连接配置

为 `CREDENTIAL_ENCRYPTION_KEY` 配置 **32 随机字节的 base64**，例如在安全终端用 `openssl rand -base64 32` 生成，通过 Wrangler secret 提示输入。不要输出到日志、提交源码或使用本地测试值。已存在加密数据时必须保留原密钥；直接替换会使凭证无法解密。新实例可以先设置 secrets，或先部署空实例再设置；未配置时连接管理明确返回 503。

`SYNC_ALLOWED_HOSTS` 可选，逗号分隔，用于自托管 Gitea/Forgejo/GitLab 主机；只填可信公网 HTTPS 主机名，无端口/路径/IP。常见公共提供方已内置允许。`WEBHOOK_ALLOWED_HOSTS` 仍默认空。

GitHub App 在网页“密钥与连接”配置 app_id、installation_id、RSA private_key 与至少 16 字符 webhook_secret；为 App 授予 Contents read/write，并订阅 push，Webhook URL 为 `/webhooks/github/<用户名>`。私钥只保存为 D1 密文。公有 GitHub 仓库可用 public 模式，无 App；generic 模式需先保存 HTTPS 凭证再请求同步。外部 App 未配置时不会返回假成功。

同步状态页可查询持久任务/错误并手动重试。上游推送结果不确定时普通操作会暂时返回 409，后台实际拉取后解除。自动重试最多五次，修复权限/网络后使用手动 pull。勿直接删除 DO reconcile marker 绕过恢复。

`npm run test:sync` 只对本地实例拉取公共 GitHub，不修改该外部仓库。SDK 验收需要 Python ≥3.10 + cryptography 和 Go ≥1.24；CI 已包含本地 HTTP/native Git/SDK 组合。真实私有 App 安装的验收需操作者自身配置，区别于可重复的提供方模拟测试。

当前验收见 [VERIFICATION.md](VERIFICATION.md)。历史报告中的描述仅针对其对应的开发阶段，不能用于当前实例的操作判断。

## 可重复的云端验收

`scripts/verify-cloud.mjs` 默认拒绝执行。操作者确认使用自己的测试实例后，设置 `ALLOW_REMOTE_ACCEPTANCE=1`、`VEXUNI_ORIGIN`、`VEXUNI_NAMESPACE`、`VEXUNI_TOKEN`，运行 `node --import tsx scripts/verify-cloud.mjs`。令牌通过安全环境注入，不写入命令行或配置。脚本只创建随机 `accept_v03_` 私有仓库，并在 finally 中删除；读取公开 GitHub，不写外部上游。可设置 `ACCEPTANCE_REPORT` 将无凭证的结果保存至忽略目录。
