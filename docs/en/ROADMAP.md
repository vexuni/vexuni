# Capability scope and delivery record

[简体中文](../ROADMAP.md) · **English**

This document records vexuni's capability scope and delivery history; the current version is **v0.1.0-beta**. Stage numbers in this document are development-order identifiers recorded before the version reset and bear no relation to the current version number. [parity.json](../parity.json) maps 40 preferred operations and 11 cross-cutting capabilities to real implementations/tests.

The initial six objectives covered authorization/ref isolation and signatures; complete bounded Git APIs; repository lifecycle; encrypted upstream connections and real synchronization; TypeScript/Python/Go SDKs, MCP, and agent examples; and successful/failing acceptance before deployment. All 51 mapped behaviors were implemented, with 40 preferred REST operations exercised on temporary Cloudflare projects. See [verification](VERIFICATION.md). Actual private GitHub App installations still need operator configuration; tests do not establish unlimited scale, SLA, every Git protocol, or full recursive-merge compatibility.

The implementation remains container-free, with JavaScript Git processing and durable R2 data rather than a hot-disk/cold-storage model. Its own API/SDK conventions are not a drop-in base-URL replacement. Missing real third-party credentials must be documented, never replaced by simulated success claims.

## Scope

The platform covers the delivered stages below plus complete Simplified Chinese/English interface and documentation support; it does not claim all GitLab features or remove existing engine limits. See [deployment](DEPLOYMENT.md) and [limits](LIMITS.md).

## Delivered stages

- Primary domain and Simplified Chinese/English interface and documentation. [Guide](DEPLOYMENT.md).
- Read-only Jupyter Notebook cells, safe outputs, source switching, and pagination. [Guide](NOTEBOOK-v37.md).
- Selected tsconfig/JSONC inheritance, aliases, JSX, and source extension resolution. [Guide](CI-TSCONFIG-v36.md).
- Integrity-checked public npm downloads cached in dedicated R2 storage. [Guide](CI-NPM-CACHE-v35.md).
- Repository-local code-index content reuse for unchanged, renamed, and copied files. [Guide](CODE-CONTENT-v34.md).
- GitHub/GitLab OAuth with explicit identity linking, MFA, and credential revocation. [Guide](OAUTH-v33.md).
- Default-branch code index, path/extension filters, fixed-commit results, and rebuilds. [Guide](CODE-SEARCH-v32.md).
- Durable merge queue with exact-candidate CI, reapproval, cancellation, and recovery. [Guide](MERGE-QUEUE-v31.md).
- One-use offline password recovery with MFA and atomic credential revocation. [Guide](PASSWORD-RECOVERY-v30.md).
- Atomic Git ref/audit intent and idempotent D1 receipt delivery. [Guide](GIT-RECEIPTS-v29.md).
- Cross-project collaboration search with live authorization and stable pagination. [Guide](SEARCH-v28.md).
- Explicitly authorized private npm dependencies in native WASM builds. [Guide](CI-PRIVATE-PACKAGES-v27.md).
- Independent project/space deploy tokens with scoped access, expiry, and rotation. [Guide](DEPLOY-TOKENS-v26.md).
- Native npm and generic package registry with immutable versions and asynchronous cleanup. [Guide](PACKAGES-v25.md).
- Space CI variable inheritance, project overrides, and cross-project revocation. [Guide](CI-WORKSPACE-VARIABLES-v24.md).
- Administrator-configured OIDC, linking, controlled registration, MFA, and revocation. [Guide](OIDC-v23.md).
- Native TypeScript/TSX/npm compilation, JS/CSS artifacts, application activation/rollback. [Guide](CI-BUILDS-v22.md).
- R2 CI caches with scoped keys, success gates, generations, and cleanup. [Guide](CI-CACHES-v21.md).
- Encrypted project variables, explicit selection, snapshots, and log masking. [Guide](CI-VARIABLES-v20.md).
- Durable timezone-aware schedules and permission-aware dispatch/cancellation. [Guide](CI-SCHEDULES-v19.md).
- Bounded page snapshots during native Git transfers. [Guide](GIT-READS-v18.md).
- Disposable complete pack cache with validation and corruption fallback. [Guide](GIT-PACK-CACHE-v17.md).
- Streaming incoming packs, R2 staging, and recoverable cleanup. [Guide](GIT-RECEIVE-v16.md).
- Bounded transient R2 recovery and private Git incident diagnostics. [Guide](GIT-RELIABILITY-v15.md).
- Fixed-commit JSON configuration, dependency workflows, parallel jobs, and artifacts. [Guide](CI-WORKFLOWS-v14.md).
- Size-aware four-way Git prefetch with backpressure and draining. [Guide](GIT-PREFETCH-v13.md).
- Durable object-closure indexing and streaming outbound packs. [Guide](GIT-SCALE-v12.md).
- Project transfers/renames, stable UUIDs, current permissions, and protected aliases. [Guide](TRANSFER-v11.md).
- Recoverable project archive with Git/LFS/collaboration/CI write barriers. [Guide](ARCHIVE-v10.md).
- Issue filters/pagination, label boards, bulk actions, and revision checks. [Guide](ISSUES-v09.md).
- CODEOWNERS, default-branch issue-closing merges, and bounded R2 concurrency. [Guide](REVIEWS-v08.md).
- Fork merge requests, line discussions, resolution gates, and target-config CI. [Guide](REVIEWS-v07.md).
- TOTP/recovery codes, sessions, profiles/activity, Markdown and private raster previews. [Guide](ACCOUNT-v06.md).
- Isolated cloud JS/WASM CI, application releases, review protection, and collaboration. [Guide](CLOUD-NATIVE-v05.md).
- Spaces/roles, administration, highlighting, and external-runner CI. [Guide](PLATFORM-v04.md).
- Expanded Git APIs, SDKs, and MCP. [Guide](VERIFICATION.md).
- Container-free JavaScript Git engine and native protocol acceptance. [Guide](VERIFICATION-v0.2.md).

## Remaining boundaries

Large initial-import throughput, uncached clones, concurrent complete Git streams, permanent packed-object storage, large fork/history algorithms, and coordinated backup recovery need separate work and evidence; see [scale plan](GIT-SCALE-PLAN.md). Full Linux/npm toolchains inside Workers, GitLab YAML/API parity, SSH/shallow/partial transport, all-history/multi-branch/regex global indexing, other package registries, scanning/quality reports, PDF preview, SAML/SCIM/Access/backchannel logout, email recovery, and recovery after losing all second factors are not implied by the delivered stages.

This is an independent implementation, not a compatibility certification or affiliation.
