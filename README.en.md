# vexuni

[简体中文](README.md) · **English**

**A small, beautiful code hosting platform that runs on Cloudflare.**

Host code, manage teams, and review changes — like GitLab or Gogs, but with no server, Docker, or containers to run. The Git service is implemented in pure JavaScript inside Workers, and every byte of data lives in your own Cloudflare account.

[Deployment](docs/en/DEPLOYMENT.md) · [Architecture](docs/en/ARCHITECTURE.md) · [Limits](docs/en/LIMITS.md) · [Changelog](docs/en/CHANGELOG.md)

---

## What it does

| Area | Capabilities |
| --- | --- |
| **Code hosting** | Public/private repositories, HTTPS clone/push/fetch, branches, tags, forks, Git LFS, upstream synchronization |
| **Code browsing** | Syntax highlighting, file history, diffs, blame, cross-project search, Markdown / image / Jupyter Notebook previews |
| **Collaboration** | Workspaces, role-based access, issues/boards/milestones, merge requests, line discussions, CODEOWNERS, protected branches |
| **CI/CD** | Push and scheduled triggers, logs, variables/secrets, caches, artifacts; cloud builds for TS/TSX, JS/CSS and locked npm dependencies, with app publishing and rollback |
| **Project management** | npm/generic package registries, releases, wikis, notifications, audit logs, administration |
| **Accounts & integrations** | Access tokens, two-factor authentication, OAuth/OIDC sign-in, webhooks, REST API, MCP, TypeScript/Python/Go SDKs |
| **Languages** | Simplified Chinese and English UI and documentation, with saved language preference |

## How it runs

A complete instance has three Workers: the **main service** handles Git, the website, and APIs; the **compiler** builds code with WASM; and the **app gateway** serves published apps on a separate domain.

| Cloudflare service | Purpose |
| --- | --- |
| Workers + Static Assets | Website, authentication, Git HTTPS, and APIs |
| Durable Objects | Per-repository write coordination and atomic ref updates |
| R2 | Git objects, LFS, packages, build artifacts, and caches |
| D1 | Users, permissions, collaboration, indexes, and job state |
| Queues + Cron + DO Alarms | Background jobs, events, retries, and cleanup |
| Worker Loader + WASM | Isolated cloud tasks, compilation, and app execution |

A push follows **Git client → main Worker authorization → repository DO coordination → R2 object storage → DO atomic ref publication**. Indexing, CI, and notifications run in the background.

## Deploy to Cloudflare

1. In `wrangler.jsonc`, set `APP_ORIGIN` (your canonical origin) and `APPS_ORIGIN` (the app gateway origin), and fill in your own D1 `database_id`.
2. Configure the `BOOTSTRAP_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` Worker secrets.
3. Run `npm run deploy` to deploy the compiler, gateway, and main Worker in order; provision the administrator via `POST /api/setup` with the bootstrap secret. Regular users register with a passkey.

See the [deployment guide](docs/en/DEPLOYMENT.md) for database migrations, resource bindings, and service wiring. When upgrading an existing instance, preserve its resources and encryption keys.

## Try locally

Requires Node.js 22.13+ and npm:

```sh
git clone https://github.com/vexuni/vexuni.git
cd vexuni
npm ci
npm run dev
```

Open [localhost:8787](http://localhost:8787). Provision the administrator via `POST /api/setup` with bootstrap secret `local-development-only-change-me` and a password of at least 12 characters. This secret is only for local development. Use a personal access token (PAT) as the password for Git HTTPS authentication.

## Scope

Cloud CI runs JS/WASM — not arbitrary shell commands, Python, or npm lifecycle scripts; general command builds can use a self-managed external runner. SSH Git transport, shallow/partial clones, and full GitLab API compatibility are not supported. See [limits](docs/en/LIMITS.md) for repository and capacity boundaries.

## Documentation

[Deployment and recovery](docs/en/DEPLOYMENT.md) · [CI/CD](docs/en/CI-BUILDS-v22.md) · [API](docs/en/API.md) · [SDK](docs/en/SDK.md) · [Contributing](CONTRIBUTING.en.md) · [Security](SECURITY.en.md)

---

Licensed under [AGPL-3.0-only](LICENSE): modified versions offered as a network service must provide their corresponding source to users. vexuni is not affiliated with GitLab, Gogs, or Cloudflare.
