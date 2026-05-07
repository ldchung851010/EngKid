# HiKid.Fun 部署指南

## 推荐部署拓扑

公网推荐使用 Cloudflare 的静态站点 + 边缘 API 组合：

- Web 前端：Cloudflare Pages，构建根目录项目，输出 `dist/`。
- Server API：Cloudflare Workers，入口为 `server/src/worker.ts`，部署产物为 `server/dist/worker.js`。
- 缓存：Cloudflare R2，绑定名必须是 `CACHE_BUCKET`，用于 TTS WAV 和例句 JSON 缓存。
- 语音：Workers 环境不能启动本地 Kitten TTS 二进制，所以线上 Workers 部署必须配置 `GLM_API_KEY`，TTS 和可选 ASR 都走智谱云端。

如果需要使用本地 Kitten TTS，则不要把 server 部署到 Workers，改用本文后半部分的 Node/Hono 单机部署。

## 服务端接口清单

所有服务端接口都挂在 `/api` 下。Node 部署入口是 `server/src/index.ts`；Cloudflare Workers 部署入口是 `server/src/worker.ts`。

| 方法 | 路径 | 用途 | 外部依赖 | 成本控制 |
|---|---|---|---|---|
| `GET` | `/api/health` | 检查 API 服务、TTS 模式、ASR 模式 | Node 本地 TTS 或云端 GLM | 无 |
| `GET` | `/api/scenes` | 返回构建时生成的静态场景元数据 | `server/data/scenes-metadata.json` | 无 |
| `POST` | `/api/intent` | 将儿童语音转写文本匹配到配置里的意图 | DeepSeek 兼容 Chat API | AI 全站每日额度 + 单 IP 小时额度 |
| `POST` | `/api/example` | 为收集到的单词生成简单英文例句和中文解释 | DeepSeek 兼容 Chat API | 磁盘缓存；缓存未命中时计入 AI 额度 |
| `POST` | `/api/tts` | 生成或返回已缓存的 WAV 语音 | 本地 Kitten TTS / 智谱 GLM-TTS（配置 GLM_API_KEY 时） | 仅缓存未命中时计入 TTS 额度 |
| `POST` | `/api/asr` | 语音识别转发至智谱 GLM-ASR（仅配置 `GLM_API_KEY` 时注册） | 智谱 AI API | ASR 全站每日额度 + 单 IP 小时额度 |
| `GET` | `/api/quota` | 返回当前请求 IP 对应的 AI/TTS/ASR 剩余额度 | 进程内额度账本 | 无 |

学习进度、积分和单词收集记录保存在浏览器本地 `LearningDataStore` 中。服务端不需要用户学习数据数据库。

## 安全检查总结

当前实现包含基础公网加固：CORS 白名单、生成接口输入边界、请求体大小限制、TTS/例句缓存，以及 AI/TTS/ASR 额度。部署时仍需要按你的真实域名和反向代理环境配置。

### 风险清单

| 严重性 | 区域 | 风险 | 建议 |
|---|---|---|---|
| 中 | CORS 配置 | 生产环境未配置 `CORS_ORIGIN` 时，跨域前端无法调用 API；如果误设为过宽来源，仍会增加滥用面。 | 同域部署可不配置；跨域部署时将 `CORS_ORIGIN` 设置为正式前端域名，多个域名用英文逗号分隔。 |
| 中 | 客户端 IP 识别 | 当前额度逻辑读取 `X-Forwarded-For` 的第一个 IP。如果边缘代理没有覆盖客户端伪造 header，单 IP 额度会不准确。 | 只在可信反向代理或 Cloudflare 后暴露 API，并由代理覆盖 `X-Forwarded-For`。 |
| 中 | 额度持久性 | 额度账本存在进程内存里。服务重启会清零，多实例部署会各自计数。 | 单实例 demo 可以接受；多实例或更严格的公益额度应改成 Redis/KV 等共享存储。 |
| 中 | `/api/quota` 暴露 | 额度状态是公开的。它不暴露密钥，但会让自动化客户端知道剩余容量。 | 透明体验可以保留公开；若出现滥用，可限制为同源或管理端访问。 |
| 低 | TTS 缓存增长 | 缓存的 WAV 文件目前没有自动清理。 | 将 `TTS_CACHE_DIR` 放在有容量监控的卷上，公网服务建议定期清理。 |
| 低 | 例句缓存增长 | `/api/example` 会把例句 JSON 缓存在磁盘，当前没有自动清理。 | 将 `EXAMPLE_CACHE_DIR` 放在有容量监控的卷上；必要时按文件时间定期清理。 |
| 低 | 鼓励语音 manifest | 音频路径来自生成的 manifest。如果攻击者能改写磁盘文件，可能影响读取路径。 | 将 `server/data` 视为应用私有目录，不允许用户写入。 |

### 公网部署最低要求

1. 全站使用 HTTPS。
2. 同域部署优先；跨域部署时设置 `CORS_ORIGIN` 为生产前端域名。
3. 反向代理必须覆盖 `X-Forwarded-For`，避免客户端伪造额度 IP。
4. 首次上线使用偏保守的 `AI_*` 和 `TTS_*` 额度，观察流量后再提高。
5. 增加或配置请求体大小和字段长度限制。
6. `DEEPSEEK_API_KEY` 和 `GLM_API_KEY` 只放在服务端环境变量中。
7. 生产日志不要记录 transcript 或 prompt。
8. Node 部署时监控 `server/data/tts-cache` 和 `server/data/example-cache` 的磁盘占用；Pages 部署时鼓励语音位于 `public/quotes` 静态资源中。

## 环境变量

必填：

```bash
DEEPSEEK_API_KEY=your-deepseek-key
```

推荐配置：

```bash
DEEPSEEK_MODEL=deepseek-v4-flash

GLM_API_KEY=your-glm-key        # 可选，配置后 ASR 和 TTS 均走云端（智谱 GLM）
TTS_VOICE=luodo                 # 云端 TTS 语音，默认 luodo
TTS_PORT=8081                   # 仅本地 TTS 模式使用
TTS_MODEL_PATH=/srv/hi-kid-fun/server/model
TTS_CACHE_DIR=/var/lib/hi-kid-fun/tts-cache
EXAMPLE_CACHE_DIR=/var/lib/hi-kid-fun/example-cache

AI_DAILY_LIMIT=5000
AI_IP_HOURLY_LIMIT=300
TTS_DAILY_LIMIT=10000
TTS_IP_HOURLY_LIMIT=600
ASR_DAILY_LIMIT=5000            # 仅云端 ASR 模式生效
ASR_IP_HOURLY_LIMIT=300         # 仅云端 ASR 模式生效

CORS_ORIGIN=https://hikid.fun
SERVER_BODY_LIMIT=262144
```

ASR 默认在浏览器本地运行，不需要服务端 ASR key。如果配置了 `GLM_API_KEY`，ASR 自动走后端转发至智谱云端（`POST /api/asr`），客户端自动检测并切换模式。

TTS 默认使用本地 Kitten TTS（需要二进制和模型文件）。如果配置了 `GLM_API_KEY`，TTS 自动走智谱 GLM-TTS 云端（`POST /api/tts`），无需本地 TTS 二进制和模型。`TTS_VOICE` 控制云端语音，默认 `tongtong`。

## Cloudflare Workers 部署 server

### 1. 准备 Cloudflare 资源

先登录 Wrangler，并创建 R2 bucket：

```bash
cd server
npm install
npx wrangler login
npx wrangler r2 bucket create hi-kid-fun-cache
```

仓库已经包含 `server/wrangler.toml`：

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

如果 R2 bucket 名称不同，需要同步修改 `bucket_name`。绑定名 `CACHE_BUCKET` 不要改，`server/src/worker.ts` 会用这个名字初始化 R2 缓存。

### 2. 配置 Workers 环境变量和密钥

敏感值使用 Wrangler Secret：

```bash
cd server
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put GLM_API_KEY
```

`GLM_API_KEY` 在 Workers 部署中强烈建议配置。没有它时 `/api/tts` 会返回 `503 TTS not available`，浏览器端无法播放 NPC 语音。

生产环境还必须配置 CORS。当前前端使用相对路径请求 `/api/*`；如果 Pages 和 Worker 不是同源，浏览器会带 `Origin`，Worker 必须允许 Pages 域名。可以在 Cloudflare Dashboard 的 Worker 变量中添加普通变量：

```text
CORS_ORIGIN=https://hikid.fun,https://hi-kid-fun.pages.dev
```

也可以把它写入 `server/wrangler.toml` 的 `[vars]`：

```toml
[vars]
DEEPSEEK_MODEL = "deepseek-v4-flash"
TTS_VOICE = "tongtong"
CORS_ORIGIN = "https://hikid.fun,https://hi-kid-fun.pages.dev"
```

### 3. 构建并发布 Worker

```bash
cd server
npm run build
npm run deploy
```

`npm run build` 会执行 TypeScript 编译，并在 `postbuild` 中生成 `server/data/scenes-metadata.json`。`npm run deploy` 会调用 `wrangler deploy` 发布 `dist/worker.js`。

部署后验证：

```bash
curl https://hi-kid-fun-api.<your-subdomain>.workers.dev/api/health
curl https://hi-kid-fun-api.<your-subdomain>.workers.dev/api/scenes
curl https://hi-kid-fun-api.<your-subdomain>.workers.dev/api/quota
```

期望 `/api/health` 返回类似：

```json
{
  "status": "ok",
  "tts": "cloud",
  "asr": "cloud"
}
```

如果 `tts` 是 `unavailable`，说明 `GLM_API_KEY` 没有生效。

### 4. 绑定正式域名或路由

前端代码目前写死请求相对路径 `/api/*`，所以最省心的生产拓扑是同一个正式域名承载 Pages 静态资源和 Worker API：

```text
https://hikid.fun/       -> Cloudflare Pages
https://hikid.fun/api/*  -> Cloudflare Worker
```

在 Cloudflare Dashboard 中：

1. 将 `hikid.fun` 绑定到 Pages 项目。
2. 给 Worker 添加 route：`hikid.fun/api/*`。
3. 将 `CORS_ORIGIN` 设置为 `https://hikid.fun`。

如果暂时只能使用 `*.pages.dev` 和 `*.workers.dev` 两个域名，可以在 Pages 的 `public/_redirects` 中添加代理规则：

```text
/api/*  https://hi-kid-fun-api.<your-subdomain>.workers.dev/api/:splat  200
```

这种方式适合预览和临时环境；正式环境仍建议使用自定义域名 + Worker route。

### 5. Workers 部署限制

- Workers 不支持启动 `server/bin/kitten-tts-server-*`，只能用 GLM 云端 TTS。
- TTS 和例句缓存写入 R2；R2 不会自动过期，后续如需清理可加 lifecycle rule 或手动删除对象前缀。
- 额度计数仍是 Worker isolate 内存 Map，不是全局强一致限流。它适合 demo 和成本保护的第一层防线，不适合严格计费。
- `AI_DAILY_LIMIT`、`TTS_DAILY_LIMIT` 等额度环境变量目前只在 Node 入口读取；Workers 入口使用代码默认值。
- Worker 入口没有 `SERVER_BODY_LIMIT` 中间件；仍应依赖路由字段校验、Cloudflare 平台请求限制和上游 API 限制。

## Cloudflare Pages 部署 web

### 1. 创建 Pages 项目

可以用 Dashboard/Git 集成，也可以用 Wrangler CLI 直接发布 `dist/`。仓库默认使用根目录 `wrangler.toml` 作为 Pages 配置来源。

Dashboard/Git 集成方式：在 Cloudflare Dashboard 中进入 Workers & Pages，创建 Pages 项目并连接 Git 仓库。构建配置：

| 配置项 | 值 |
|---|---|
| Framework preset | `Vite` 或 `None` |
| Root directory | 仓库根目录 |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Node version | `22` |

如果 Dashboard 使用环境变量控制 Node 版本，添加：

```text
NODE_VERSION=22
```

前端不会读取 `DEEPSEEK_API_KEY`、`GLM_API_KEY` 等服务端密钥，不要把这些密钥配置到 Pages 项目。

Wrangler CLI 方式：仓库根目录提供了 Pages 专用的 `wrangler.toml`：

```toml
name = "hi-kid-fun"
pages_build_output_dir = "./dist"
compatibility_date = "2024-12-01"
```

本地构建后直接部署：

```bash
npm ci
npm run build
npm run deploy
```

如果 Pages 项目还不存在，Wrangler 会引导创建；如果已经在 Cloudflare 上创建过，`wrangler.toml` 里的 `name` 必须和 Pages 项目名一致。需要区分的是：`wrangler pages deploy` 只发布前端静态产物，不会部署 `server` Worker；API 仍要按上一节执行 `cd server && npm run deploy`。

也可以用 preview 分支名发布一次性预览：

```bash
npm run deploy -- --branch preview
```

### 2. 路由 API

Pages 发布后，浏览器会从当前域名请求 `/api/health`、`/api/scenes`、`/api/tts`、`/api/intent`、`/api/example` 和可选的 `/api/asr`。因此必须完成下面二选一：

| 方式 | 适用场景 | 操作 |
|---|---|---|
| Worker route | 正式域名 | 给 Worker 配置 `hikid.fun/api/*`，Pages 使用同一个 `hikid.fun` |
| `_redirects` 代理 | Pages 预览或临时域名 | 在 `public/_redirects` 添加 `/api/*  https://<worker-domain>/api/:splat  200` |

没有 API 路由时，前端页面可以打开，但场景列表、NPC 语音、意图匹配和例句生成都会失败。

### 3. Pages 部署后验证

打开 Pages 域名后检查：

```bash
curl https://hikid.fun/api/health
curl https://hikid.fun/api/scenes
```

然后在浏览器里验证：

- 首页能加载场景卡片。
- 进入任意场景后，`/api/health` 显示 `tts: "cloud"`。
- NPC 语音可以播放。
- 按住说话并松开后，云端 ASR 或本地 Whisper 能返回文本。
- 完成任务后，首页进度保存在当前浏览器；导出、导入、重置数据可用。

## Cloudflare 参考资料

- [Workers Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Wrangler Workers 命令](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
- [R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [Pages 构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/)

## 构建

项目要求 Node 22，和仓库里的 `.nvmrc` 保持一致。

```bash
nvm use
npm install
npm run build

cd server
nvm use
npm install
npm run build
```

前端产物输出到 `dist/`，服务端编译产物输出到 `server/dist/`。

## 安装 Kitten TTS 二进制和模型

本项目使用 `second-state/kitten_tts_rs` 的 OpenAI 兼容 TTS server。上游仓库是 [second-state/kitten_tts_rs](https://github.com/second-state/kitten_tts_rs)。

上游 release 包里包含两个程序：

- `kitten-tts`：命令行一次性生成语音的 CLI，本项目不使用。
- `kitten-tts-server`：OpenAI 兼容 API server，本项目需要这个文件。

本项目要求把不同平台的 `kitten-tts-server` 放在 `server/bin/` 下，并使用固定文件名：

| 平台 | 上游下载包 | 解压后的文件 | 放入本项目后的文件名 |
|---|---|---|---|
| macOS Apple Silicon / arm64 | `kitten-tts-aarch64-macos.tar.gz` | `kitten-tts-server` | `server/bin/kitten-tts-server-aarch64-macos` |
| Linux x86_64 | `kitten-tts-x86_64-linux.tar.gz` | `kitten-tts-server` | `server/bin/kitten-tts-server-x86_64-linux` |

示例安装命令：

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

服务端启动时会自动选择当前平台对应的文件：

- macOS arm64: `server/bin/kitten-tts-server-aarch64-macos`
- Linux x86_64: `server/bin/kitten-tts-server-x86_64-linux`

模型也来自同一个上游 release。下载模型包：

```bash
curl -L -o /tmp/kitten-tts/kitten-tts-models.tar.gz \
  https://github.com/second-state/kitten_tts_rs/releases/latest/download/kitten-tts-models.tar.gz
tar -xzf /tmp/kitten-tts/kitten-tts-models.tar.gz -C /tmp/kitten-tts
```

上游模型包会解出 `models/` 目录，里面通常包含：

```text
models/
  kitten-tts-mini/
  kitten-tts-micro/
  kitten-tts-nano/
  kitten-tts-nano-int8/
```

本项目默认 `TTS_MODEL_PATH` 指向 `server/model`，当前只使用 micro 模型文件。`server/model/` 需要包含：

```text
server/model/
  kitten_tts_micro_v0_8.onnx
```

安装 micro 模型示例：

```bash
rm -rf server/model
mkdir -p server/model
cp /tmp/kitten-tts/models/kitten-tts-micro/kitten_tts_micro_v0_8.onnx server/model/
```

如果你把模型文件放在其他目录，可以设置 `TTS_MODEL_PATH` 指向该目录。

## 运行

单机部署示例：

```bash
cd server
DEEPSEEK_API_KEY=your-deepseek-key \
TTS_CACHE_DIR=/var/lib/hi-kid-fun/tts-cache \
EXAMPLE_CACHE_DIR=/var/lib/hi-kid-fun/example-cache \
npm start
```

服务端会在 `3001` 端口启动 Hono Node server，并在 `TTS_PORT` 上启动匹配当前平台的 TTS 二进制：

- macOS arm64: `server/bin/kitten-tts-server-aarch64-macos`
- Linux x86_64: `server/bin/kitten-tts-server-x86_64-linux`

前端 `dist/` 可以交给 Nginx、Caddy、CDN 或其他静态文件服务托管。将 `/api/*` 代理到 Hono Node server。

## Nginx 示例

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

线上建议只保留一个 canonical 前端域名。如果应用服务仍启用 CORS，请配置为只允许该域名。

## 进程管理示例

systemd 示例：

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

启动前创建可写数据目录：

```bash
sudo mkdir -p /var/lib/hi-kid-fun/tts-cache
sudo mkdir -p /var/lib/hi-kid-fun/example-cache
sudo chown -R hi-kid-fun:hi-kid-fun /var/lib/hi-kid-fun
```

## 部署后验证

部署完成后先检查接口：

```bash
curl https://hikid.fun/api/health    # 确认 tts/asr 的 cloud/local 模式
curl https://hikid.fun/api/scenes
curl https://hikid.fun/api/quota     # 确认 ai/tts/asr 额度
```

然后打开前端，进入一个场景，确认：

- 浏览器本地麦克风录音正常。
- NPC 语音可以播放。
- 重复相同 TTS 请求时返回 `X-TTS-Cache: HIT`。
- 重复相同例句请求时返回 `X-Example-Cache: HIT`。
- 完成任务后，首页能看到场景进度。
- 首页 `Data` 按钮可以导出和导入学习数据。

## 运维说明

- `public/quotes` 保存预生成的鼓励语音，可重新生成并随前端静态资源发布。
- `TTS_CACHE_DIR` 保存生成语音缓存；如果希望重新部署后保留热缓存，可以备份该目录。
- `EXAMPLE_CACHE_DIR` 保存例句缓存；如果希望减少大模型调用，可以跨部署保留该目录。
- 浏览器学习数据属于用户本地数据，不属于服务端备份范围。
- 多实例部署时，需要 sticky routing，或将进程内额度账本替换成共享存储。
