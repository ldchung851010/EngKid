# HiKid.Fun 部署指南

## 服务端接口清单

所有服务端接口都挂在 `/api` 下，入口在 `server/src/index.ts`。

| 方法 | 路径 | 用途 | 外部依赖 | 成本控制 |
|---|---|---|---|---|
| `GET` | `/api/health` | 检查 Fastify 服务和本地 TTS 是否就绪 | 本地 Kitten TTS 服务 | 无 |
| `GET` | `/api/scenes` | 从 `src/scenes/*/config.ts` 返回静态场景元数据 | 文件系统 | 无 |
| `POST` | `/api/intent` | 将儿童语音转写文本匹配到配置里的意图 | DeepSeek 兼容 Chat API | AI 全站每日额度 + 单 IP 小时额度 |
| `POST` | `/api/example` | 为收集到的单词生成简单英文例句和中文解释 | DeepSeek 兼容 Chat API | 磁盘缓存；缓存未命中时计入 AI 额度 |
| `POST` | `/api/tts` | 生成或返回已缓存的 WAV 语音 | 本地 Kitten TTS 服务 | 仅缓存未命中时计入 TTS 额度 |
| `GET` | `/api/quotes` | 返回预生成的鼓励语音 manifest | 文件系统 | 无 |
| `GET` | `/api/quotes/:id/audio` | 返回预生成的鼓励语音 WAV 文件 | 文件系统 | 无 |
| `GET` | `/api/quota` | 返回当前请求 IP 对应的 AI/TTS 剩余额度 | 进程内额度账本 | 无 |

学习进度、积分和单词收集记录保存在浏览器本地 `LearningDataStore` 中。服务端不需要用户学习数据数据库。

## 安全检查总结

当前实现包含基础公网加固：CORS 白名单、生成接口输入边界、请求体大小限制、TTS/例句缓存、AI/TTS 额度，以及可信代理开关。部署时仍需要按你的真实域名和反向代理环境配置。

### 风险清单

| 严重性 | 区域 | 风险 | 建议 |
|---|---|---|---|
| 中 | CORS 配置 | 生产环境未配置 `CORS_ORIGIN` 时，跨域前端无法调用 API；如果误设为过宽来源，仍会增加滥用面。 | 同域部署可不配置；跨域部署时将 `CORS_ORIGIN` 设置为正式前端域名，多个域名用英文逗号分隔。 |
| 中 | 可信代理配置 | `TRUST_PROXY=true` 后，Fastify 会基于反向代理头识别客户端 IP。如果边缘代理没有覆盖客户端伪造 header，单 IP 额度会不准确。 | 只在可信反向代理后开启 `TRUST_PROXY=true`，并由代理覆盖 `X-Forwarded-For`。直接暴露 Node 服务时保持默认 `false`。 |
| 中 | 额度持久性 | 额度账本存在进程内存里。服务重启会清零，多实例部署会各自计数。 | 单实例 demo 可以接受；多实例或更严格的公益额度应改成 Redis/KV 等共享存储。 |
| 中 | `/api/quota` 暴露 | 额度状态是公开的。它不暴露密钥，但会让自动化客户端知道剩余容量。 | 透明体验可以保留公开；若出现滥用，可限制为同源或管理端访问。 |
| 低 | TTS 缓存增长 | 缓存的 WAV 文件目前没有自动清理。 | 将 `TTS_CACHE_DIR` 放在有容量监控的卷上，公网服务建议定期清理。 |
| 低 | 例句缓存增长 | `/api/example` 会把例句 JSON 缓存在磁盘，当前没有自动清理。 | 将 `EXAMPLE_CACHE_DIR` 放在有容量监控的卷上；必要时按文件时间定期清理。 |
| 低 | 鼓励语音 manifest | 音频路径来自生成的 manifest。如果攻击者能改写磁盘文件，可能影响读取路径。 | 将 `server/data` 视为应用私有目录，不允许用户写入。 |

### 公网部署最低要求

1. 全站使用 HTTPS。
2. 同域部署优先；跨域部署时设置 `CORS_ORIGIN` 为生产前端域名。
3. 只有在可信反向代理后才设置 `TRUST_PROXY=true`，反向代理必须覆盖 `X-Forwarded-For`。
4. 首次上线使用偏保守的 `AI_*` 和 `TTS_*` 额度，观察流量后再提高。
5. 增加或配置请求体大小和字段长度限制。
6. `DEEPSEEK_API_KEY` 只放在服务端环境变量中。
7. 生产日志不要记录 transcript 或 prompt。
8. 监控 `server/data/tts-cache` 和 `server/data/quotes` 的磁盘占用。

## 环境变量

必填：

```bash
DEEPSEEK_API_KEY=your-deepseek-key
```

推荐配置：

```bash
DEEPSEEK_MODEL=deepseek-v4-flash

TTS_PORT=8081
TTS_MODEL_PATH=/srv/hi-kid-fun/server/model
TTS_CACHE_DIR=/var/lib/hi-kid-fun/tts-cache
EXAMPLE_CACHE_DIR=/var/lib/hi-kid-fun/example-cache

AI_DAILY_LIMIT=5000
AI_IP_HOURLY_LIMIT=300
TTS_DAILY_LIMIT=10000
TTS_IP_HOURLY_LIMIT=600

CORS_ORIGIN=https://learn.example.com
TRUST_PROXY=true
SERVER_BODY_LIMIT=262144
```

ASR 在浏览器本地运行，不需要服务端 ASR key。

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

服务端会在 `3001` 端口启动 Fastify，并在 `TTS_PORT` 上启动匹配当前平台的 TTS 二进制：

- macOS arm64: `server/bin/kitten-tts-server-aarch64-macos`
- Linux x86_64: `server/bin/kitten-tts-server-x86_64-linux`

前端 `dist/` 可以交给 Nginx、Caddy、CDN 或其他静态文件服务托管。将 `/api/*` 代理到 Fastify 服务。

## Nginx 示例

```nginx
server {
  listen 443 ssl http2;
  server_name learn.example.com;

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
Environment=TTS_CACHE_DIR=/var/lib/hi-kid-fun/tts-cache
Environment=EXAMPLE_CACHE_DIR=/var/lib/hi-kid-fun/example-cache
Environment=AI_DAILY_LIMIT=5000
Environment=AI_IP_HOURLY_LIMIT=300
Environment=TTS_DAILY_LIMIT=10000
Environment=TTS_IP_HOURLY_LIMIT=600
Environment=CORS_ORIGIN=https://learn.example.com
Environment=TRUST_PROXY=true
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
curl https://learn.example.com/api/health
curl https://learn.example.com/api/scenes
curl https://learn.example.com/api/quota
```

然后打开前端，进入一个场景，确认：

- 浏览器本地麦克风录音正常。
- NPC 语音可以播放。
- 重复相同 TTS 请求时返回 `X-TTS-Cache: HIT`。
- 重复相同例句请求时返回 `X-Example-Cache: HIT`。
- 完成任务后，首页能看到场景进度。
- 首页 `Data` 按钮可以导出和导入学习数据。

## 运维说明

- `server/data/quotes` 保存预生成的鼓励语音，可重新生成。
- `TTS_CACHE_DIR` 保存生成语音缓存；如果希望重新部署后保留热缓存，可以备份该目录。
- `EXAMPLE_CACHE_DIR` 保存例句缓存；如果希望减少大模型调用，可以跨部署保留该目录。
- 浏览器学习数据属于用户本地数据，不属于服务端备份范围。
- 多实例部署时，需要 sticky routing，或将进程内额度账本替换成共享存储。
