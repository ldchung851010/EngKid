# HiKid.Fun Deployment Guide

## Recommended deployment topology

For public deployment, the recommended setup is a Cloudflare static site plus an edge API:

- Web frontend: Cloudflare Pages, built from the repository root, outputting `dist/`.
- Server API: Cloudflare Workers, entry point `server/src/worker.ts`, deployed artifact `server/dist/worker.js`.
- Cache: Cloudflare R2, with the binding name `CACHE_BUCKET`, used for TTS WAV files and example-sentence JSON cache.
- Voice: the Workers environment cannot start the local Kitten TTS binary, so public Workers deployments must configure `GLM_API_KEY`; TTS and optional ASR then use Zhipu GLM cloud services.

If you need local Kitten TTS, do not deploy the server to Workers. Use the Node/Hono single-server deployment described later in this guide.

## Server API endpoints

All server endpoints are under `/api`. The Node deployment entry point is `server/src/index.ts`; the Cloudflare Workers entry point is `server/src/worker.ts`.

| Method | Path | Purpose | External dependency | Cost control |
|---|---|---|---|---|
| `GET` | `/api/health` | Check API service, TTS mode, and ASR mode | Local Node TTS or cloud GLM | None |
| `GET` | `/api/scenes` | Return static scene metadata generated at build time | `server/data/scenes-metadata.json` | None |
| `POST` | `/api/intent` | Match a child's speech transcript to configured intents | DeepSeek-compatible Chat API | Site-wide daily AI quota + per-IP hourly quota |
| `POST` | `/api/example` | Generate a simple English example sentence and explanation for a collected word | DeepSeek-compatible Chat API | Disk cache; only cache misses count against AI quota |
| `POST` | `/api/tts` | Generate or return cached WAV speech | Local Kitten TTS / Zhipu GLM-TTS when `GLM_API_KEY` is configured | Only cache misses count against TTS quota |
| `POST` | `/api/asr` | Forward speech recognition to Zhipu GLM-ASR; registered only when `GLM_API_KEY` is configured | Zhipu AI API | Site-wide daily ASR quota + per-IP hourly quota |
| `GET` | `/api/quota` | Return remaining AI/TTS/ASR quota for the current request IP | In-process quota ledger | None |

Learning progress, points, and collected-word records are stored locally in the browser by `LearningDataStore`. The server does not require a database for learner progress.

## Security review summary

The current implementation includes basic public-facing safeguards: a CORS allowlist, input bounds on generation endpoints, request-body size limits, TTS/example caching, and AI/TTS/ASR quotas. Production deployment still needs configuration for your real domain and reverse-proxy environment.

### Risk list

| Severity | Area | Risk | Recommendation |
|---|---|---|---|
| Medium | CORS configuration | If `CORS_ORIGIN` is not configured in production, a cross-origin frontend cannot call the API. If it is set too broadly, the abuse surface increases. | Same-origin deployments can omit it. For cross-origin deployments, set `CORS_ORIGIN` to the production frontend domains, separated by commas. |
| Medium | Client IP detection | Quota logic currently reads the first IP from `X-Forwarded-For`. If the edge proxy does not overwrite a spoofed client header, per-IP quotas can be inaccurate. | Expose the API only behind a trusted reverse proxy or Cloudflare and have the proxy overwrite `X-Forwarded-For`. |
| Medium | Quota persistence | The quota ledger is stored in process memory. A restart resets it, and multiple instances count independently. | A single-instance demo can accept this. For multiple instances or stricter public-service limits, move quotas to shared storage such as Redis or KV. |
| Medium | `/api/quota` exposure | Quota status is public. It does not expose secrets, but automated clients can see remaining capacity. | Keeping it public is acceptable for transparency. If abuse appears, limit it to same-origin or admin access. |
| Low | TTS cache growth | Cached WAV files are not currently cleaned automatically. | Put `TTS_CACHE_DIR` on a monitored volume and clean it periodically for public services. |
| Low | Example cache growth | `/api/example` stores example JSON on disk and currently has no automatic cleanup. | Put `EXAMPLE_CACHE_DIR` on a monitored volume and clean old files by age when necessary. |
| Low | Encouragement-audio manifest | Audio paths come from a generated manifest. If an attacker can rewrite disk files, read paths could be affected. | Treat `server/data` as an application-private directory and do not allow user writes. |

### Minimum requirements for public deployment

1. Use HTTPS everywhere.
2. Prefer same-origin deployment; for cross-origin deployment, set `CORS_ORIGIN` to the production frontend domain.
3. The reverse proxy must overwrite `X-Forwarded-For` to prevent clients from spoofing the quota IP.
4. Start with conservative `AI_*` and `TTS_*` quotas and increase them after observing traffic.
5. Add or configure request-body and field-length limits.
6. Keep `DEEPSEEK_API_KEY` and `GLM_API_KEY` only in server-side environment variables.
7. Do not log transcripts or prompts in production logs.
8. For Node deployments, monitor disk usage in `server/data/tts-cache` and `server/data/example-cache`. For Pages deployments, encouragement audio is stored under the static `public/quotes` assets.

## Environment variables

Required:

```bash
DEEPSEEK_API_KEY=your-deepseek-key
```

Recommended configuration:

```bash
DEEPSEEK_MODEL=deepseek-v4-flash

GLM_API_KEY=your-glm-key        # Optional. When set, ASR and TTS both use Zhipu GLM cloud services.
TTS_VOICE=luodo                 # Cloud TTS voice; default: luodo
TTS_PORT=8081                   # Used only in local TTS mode
TTS_MODEL_PATH=/srv/hi-kid-fun/server/model
TTS_CACHE_DIR=/var/lib/hi-kid-fun/tts-cache
EXAMPLE_CACHE_DIR=/var/lib/hi-kid-fun/example-cache

AI_DAILY_LIMIT=5000
AI_IP_HOURLY_LIMIT=300
TTS_DAILY_LIMIT=10000
TTS_IP_HOURLY_LIMIT=600
ASR_DAILY_LIMIT=5000            # Applies only in cloud ASR mode
ASR_IP_HOURLY_LIMIT=300         # Applies only in cloud ASR mode

CORS_ORIGIN=https://hikid.fun
SERVER_BODY_LIMIT=262144
```

ASR runs locally in the browser by default and does not require a server-side ASR key. If `GLM_API_KEY` is configured, ASR automatically switches to the backend proxy for Zhipu cloud ASR (`POST /api/asr`); the client detects this and switches modes automatically.

TTS uses local Kitten TTS by default and therefore needs the binary and model files. If `GLM_API_KEY` is configured, TTS automatically uses Zhipu GLM-TTS through `POST /api/tts`, with no local TTS binary or model required. `TTS_VOICE` controls the cloud voice; the default in the current configuration is `tongtong`.

## Deploying the server with Cloudflare Workers

### 1. Prepare Cloudflare resources

Log in with Wrangler and create the R2 bucket:

```bash
cd server
npm install
npx wrangler login
npx wrangler r2 bucket create hi-kid-fun-cache
```

The repository already includes `server/wrangler.toml`:

```toml
name = "hi-kid-fun-api"
main = "dist/worker.js"
compatibility_date = "2024-12-01"

[vars]
DEEPSEEK_MODEL = "deepseek-v4-flash"
TTS_VOICE = "tongtong"

[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "hi-kid-fun-cache"
```

If your R2 bucket uses a different name, update `bucket_name`. Do not change the binding name `CACHE_BUCKET`; `server/src/worker.ts` uses that name to initialize the R2 cache.

### 2. Configure Workers environment variables and secrets

Use Wrangler Secrets for sensitive values:

```bash
cd server
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put GLM_API_KEY
```

`GLM_API_KEY` is strongly recommended for Workers deployments. Without it, `/api/tts` returns `503 TTS not available`, so the browser cannot play NPC speech.

Production also requires CORS configuration. The frontend currently calls `/api/*` with relative paths. If Pages and the Worker are not on the same origin, the browser sends an `Origin` header and the Worker must allow the Pages domain. Add a normal variable in the Worker settings in the Cloudflare Dashboard:

```text
CORS_ORIGIN=https://hikid.fun,https://hi-kid-fun.pages.dev
```

You can also put it in the `[vars]` section of `server/wrangler.toml`:

```toml
[vars]
DEEPSEEK_MODEL = "deepseek-v4-flash"
TTS_VOICE = "tongtong"
CORS_ORIGIN = "https://hikid.fun,https://hi-kid-fun.pages.dev"
```

### 3. Build and deploy the Worker

```bash
cd server
npm run build
npm run deploy
```

`npm run build` compiles TypeScript and generates `server/data/scenes-metadata.json` during `postbuild`. `npm run deploy` runs `wrangler deploy` to publish `dist/worker.js`.

Verify after deployment:

```bash
curl https://hi-kid-fun-api.<your-subdomain>.workers.dev/api/health
curl https://hi-kid-fun-api.<your-subdomain>.workers.dev/api/scenes
curl https://hi-kid-fun-api.<your-subdomain>.workers.dev/api/quota
```

Expected `/api/health` response:

```json
{
  "status": "ok",
  "tts": "cloud",
  "asr": "cloud"
}
```

If `tts` is `unavailable`, `GLM_API_KEY` is not active.

### 4. Bind the production domain or route

The frontend calls `/api/*` with relative paths by default, so the simplest production topology uses one production domain for both Pages static assets and the Worker API:

```text
https://hikid.fun/       -> Cloudflare Pages
https://hikid.fun/api/*  -> Cloudflare Worker
```

In the Cloudflare Dashboard:

1. Bind `hikid.fun` to the Pages project.
2. Add the Worker route `hikid.fun/api/*`.
3. Set `CORS_ORIGIN` to `https://hikid.fun`.

### 5. Workers deployment limitations

- Workers cannot start `server/bin/kitten-tts-server-*`; they can only use GLM cloud TTS.
- TTS and example caches are stored in R2. R2 objects do not expire automatically unless you add a lifecycle rule or delete prefixes manually.
- Quota counters remain in an in-memory Map inside each Worker isolate. This is suitable as a first layer for demos and cost protection, not for strict billing or globally consistent rate limiting.
- Quota environment variables such as `AI_DAILY_LIMIT` and `TTS_DAILY_LIMIT` are currently read only by the Node entry point; the Workers entry point uses code defaults.
- The Worker entry point does not use the `SERVER_BODY_LIMIT` middleware. Continue to rely on route-level field validation, Cloudflare platform request limits, and upstream API limits.

### 6. Configure Cloudflare WAF rate limiting

The application quota endpoint provides friendly quota feedback, but per-isolate memory is not globally consistent and cannot be the only production rate limiter. Add Cloudflare WAF Rate Limiting to block obvious abuse and cost attacks.

In the Cloudflare Dashboard:

1. Open the `hikid.fun` zone.
2. Go to `Security` -> `WAF` -> `Rate limiting rules`.
3. Create rules matching `http.host eq "hikid.fun"` and protect the expensive endpoints separately.

Suggested rules:

| Rule | Match expression | Suggested threshold | Action |
|---|---|---|---|
| `limit-asr` | `(http.host eq "hikid.fun" and http.request.uri.path eq "/api/asr")` | 10 requests per IP per minute | Block for 10 minutes |
| `limit-tts` | `(http.host eq "hikid.fun" and http.request.uri.path eq "/api/tts")` | 60 requests per IP per minute | Block for 10 minutes |
| `limit-ai-text` | `(http.host eq "hikid.fun" and http.request.uri.path in {"/api/intent" "/api/example"})` | 60 requests per IP per minute | Block for 10 minutes |
| `limit-api-global` | `(http.host eq "hikid.fun" and starts_with(http.request.uri.path, "/api/"))` | 300 requests per IP per 5 minutes | Managed Challenge or block for 10 minutes |

Configuration notes:

- Use client IP as the counting characteristic.
- You can begin with `Log` or `Managed Challenge` for one or two days, then switch to `Block` after confirming normal classroom use is unaffected.
- ASR has higher cost and larger request bodies, so its threshold should be much lower than TTS and text AI.
- If the Worker remains directly accessible through `*.workers.dev`, WAF rules for your custom zone do not protect the `workers.dev` hostname. For production, avoid public direct use of `workers.dev` and route traffic through `hikid.fun/api/*`.
- Keep the in-application quota layer because it gives the frontend clear `429` and `Retry-After` responses, but do not treat it as the only defense.

## Deploying the web app with Cloudflare Pages

### 1. Create the Pages project

You can use the Dashboard/Git integration or deploy `dist/` directly with Wrangler CLI. The repository uses the root `wrangler.toml` as the Pages configuration source.

For Dashboard/Git integration, open Workers & Pages in the Cloudflare Dashboard, create a Pages project, and connect the Git repository. Build settings:

| Setting | Value |
|---|---|
| Framework preset | `Vite` or `None` |
| Root directory | Repository root |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Node version | `22` |

If the Dashboard uses an environment variable to select Node, add:

```text
NODE_VERSION=22
```

The frontend does not read server-side secrets such as `DEEPSEEK_API_KEY` or `GLM_API_KEY`. Do not configure those secrets in the Pages project.

For Wrangler CLI, the repository root contains a Pages-specific `wrangler.toml`:

```toml
name = "hi-kid-fun"
pages_build_output_dir = "./dist"
compatibility_date = "2024-12-01"
```

Build locally and deploy:

```bash
npm ci
npm run build
npm run deploy
```

If the Pages project does not yet exist, Wrangler guides you through creation. If it already exists in Cloudflare, the `name` in `wrangler.toml` must match the Pages project name. Note that `wrangler pages deploy` publishes only the frontend static output; it does not deploy the `server` Worker. Deploy the API separately with `cd server && npm run deploy`.

You can also publish a one-off preview using a preview branch name:

```bash
npm run deploy -- --branch preview
```

### 2. Route the API

After Pages is published, the browser requests `/api/health`, `/api/scenes`, `/api/tts`, `/api/intent`, `/api/example`, and optional `/api/asr` from the current domain. The production domain therefore needs the Worker route `hikid.fun/api/*`, with Pages and the Worker sharing the same `hikid.fun` origin.

Without the API route, the frontend can open, but scene lists, NPC speech, intent matching, and example generation fail.

### 3. Verify after Pages deployment

After opening the Pages domain, check:

```bash
curl https://hikid.fun/api/health
curl https://hikid.fun/api/scenes
```

Then verify in the browser:

- The home page loads scene cards.
- After entering any scene, `/api/health` reports `tts: "cloud"`.
- NPC speech plays.
- Holding and releasing the talk button returns text through cloud ASR or local Whisper.
- After completing a task, home-page progress remains stored in the current browser.
- Export, import, and reset learner data all work.

## Cloudflare references

- [Workers Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Wrangler Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/)

## Build

The project requires Node 22, matching the repository `.nvmrc`.

```bash
nvm use
npm install
npm run build

cd server
nvm use
npm install
npm run build
```

Frontend output is written to `dist/`; server output is written to `server/dist/`.

## Install the Kitten TTS binary and model

This project uses the OpenAI-compatible TTS server from `second-state/kitten_tts_rs`. The upstream repository is [second-state/kitten_tts_rs](https://github.com/second-state/kitten_tts_rs).

The upstream release contains two programs:

- `kitten-tts`: a one-shot command-line TTS CLI; this project does not use it.
- `kitten-tts-server`: the OpenAI-compatible API server required by this project.

Place platform-specific `kitten-tts-server` binaries under `server/bin/` with fixed file names:

| Platform | Upstream package | Extracted file | File name in this project |
|---|---|---|---|
| macOS Apple Silicon / arm64 | `kitten-tts-aarch64-macos.tar.gz` | `kitten-tts-server` | `server/bin/kitten-tts-server-aarch64-macos` |
| Linux x86_64 | `kitten-tts-x86_64-linux.tar.gz` | `kitten-tts-server` | `server/bin/kitten-tts-server-x86_64-linux` |

Example installation commands:

```bash
mkdir -p server/bin /tmp/kitten-tts

# macOS Apple Silicon / arm64
curl -L -o /tmp/kitten-tts/kitten-tts-aarch64-macos.tar.gz \
  https://github.com/second-state/kitten_tts_rs/releases/latest/download/kitten-tts-aarch64-macos.tar.gz
tar -xzf /tmp/kitten-tts/kitten-tts-aarch64-macos.tar.gz -C /tmp/kitten-tts
cp /tmp/kitten-tts/kitten-tts-server server/bin/kitten-tts-server-aarch64-macos
chmod +x server/bin/kitten-tts-server-aarch64-macos

# Linux x86_64
curl -L -o /tmp/kitten-tts/kitten-tts-x86_64-linux.tar.gz \
  https://github.com/second-state/kitten_tts_rs/releases/latest/download/kitten-tts-x86_64-linux.tar.gz
tar -xzf /tmp/kitten-tts/kitten-tts-x86_64-linux.tar.gz -C /tmp/kitten-tts
cp /tmp/kitten-tts/kitten-tts-server server/bin/kitten-tts-server-x86_64-linux
chmod +x server/bin/kitten-tts-server-x86_64-linux
```

At server startup, the platform-specific file is selected automatically:

- macOS arm64: `server/bin/kitten-tts-server-aarch64-macos`
- Linux x86_64: `server/bin/kitten-tts-server-x86_64-linux`

The models come from the same upstream release. Download the model package:

```bash
curl -L -o /tmp/kitten-tts/kitten-tts-models.tar.gz \
  https://github.com/second-state/kitten_tts_rs/releases/latest/download/kitten-tts-models.tar.gz
tar -xzf /tmp/kitten-tts/kitten-tts-models.tar.gz -C /tmp/kitten-tts
```

The upstream model package extracts a `models/` directory that usually contains:

```text
models/
  kitten-tts-mini/
  kitten-tts-micro/
  kitten-tts-nano/
  kitten-tts-nano-int8/
```

This project points `TTS_MODEL_PATH` to `server/model` by default and currently uses only the micro model. `server/model/` must contain:

```text
server/model/
  kitten_tts_micro_v0_8.onnx
```

Example micro-model installation:

```bash
rm -rf server/model
mkdir -p server/model
cp /tmp/kitten-tts/models/kitten-tts-micro/kitten_tts_micro_v0_8.onnx server/model/
```

If you store the model elsewhere, set `TTS_MODEL_PATH` to that directory.

## Run

Single-server deployment example:

```bash
cd server
DEEPSEEK_API_KEY=your-deepseek-key \
TTS_CACHE_DIR=/var/lib/hi-kid-fun/tts-cache \
EXAMPLE_CACHE_DIR=/var/lib/hi-kid-fun/example-cache \
npm start
```

The server starts the Hono Node server on port `3001` and starts the TTS binary for the current platform on `TTS_PORT`:

- macOS arm64: `server/bin/kitten-tts-server-aarch64-macos`
- Linux x86_64: `server/bin/kitten-tts-server-x86_64-linux`

The frontend `dist/` can be hosted by Nginx, Caddy, a CDN, or any other static-file service. Proxy `/api/*` to the Hono Node server.

## Nginx example

```nginx
server {
  listen 443 ssl http2;
  server_name hikid.fun;

  root /srv/hi-kid-fun/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 256k;
  }
}
```

For production, keep a single canonical frontend domain where possible. If the application server still has CORS enabled, allow only that domain.

## Process management example

Example systemd unit:

```ini
[Unit]
Description=HiKid.Fun API
After=network.target

[Service]
WorkingDirectory=/srv/hi-kid-fun/server
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
Environment=DEEPSEEK_API_KEY=your-deepseek-key
Environment=DEEPSEEK_MODEL=deepseek-v4-flash
Environment=GLM_API_KEY=your-glm-key
Environment=TTS_VOICE=luodo
Environment=TTS_CACHE_DIR=/var/lib/hi-kid-fun/tts-cache
Environment=EXAMPLE_CACHE_DIR=/var/lib/hi-kid-fun/example-cache
Environment=AI_DAILY_LIMIT=5000
Environment=AI_IP_HOURLY_LIMIT=300
Environment=TTS_DAILY_LIMIT=10000
Environment=TTS_IP_HOURLY_LIMIT=600
Environment=ASR_DAILY_LIMIT=5000
Environment=ASR_IP_HOURLY_LIMIT=300
Environment=CORS_ORIGIN=https://hikid.fun
Environment=SERVER_BODY_LIMIT=262144

[Install]
WantedBy=multi-user.target
```

Create writable data directories before starting the service:

```bash
sudo mkdir -p /var/lib/hi-kid-fun/tts-cache
sudo mkdir -p /var/lib/hi-kid-fun/example-cache
sudo chown -R hi-kid-fun:hi-kid-fun /var/lib/hi-kid-fun
```

## Verify after deployment

After deployment, check the API first:

```bash
curl https://hikid.fun/api/health    # Confirm the cloud/local modes for TTS and ASR.
curl https://hikid.fun/api/scenes
curl https://hikid.fun/api/quota     # Confirm AI/TTS/ASR quota status.
```

Then open the frontend, enter a scene, and verify:

- Browser microphone recording works.
- NPC speech plays.
- Repeating the same TTS request returns `X-TTS-Cache: HIT`.
- Repeating the same example request returns `X-Example-Cache: HIT`.
- After completing a task, the home page shows scene progress.
- The home-page `Data` button can export and import learner data.

## Operations notes

- `public/quotes` stores pregenerated encouragement audio that can be regenerated and shipped with the frontend static assets.
- `TTS_CACHE_DIR` stores generated speech cache. Back up this directory if you want to keep a warm cache across redeployments.
- `EXAMPLE_CACHE_DIR` stores example-sentence cache. Keep it across deployments if you want to reduce LLM calls.
- Browser learner data is user-local data and is not part of server backups.
- For multi-instance deployment, use sticky routing or replace the in-process quota ledger with shared storage.
