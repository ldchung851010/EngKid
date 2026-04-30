---
date: 2026-04-26
topic: technology-research
status: complete
---

# 场景引擎 — 技术调研报告

调研日期：2026-04-26。所有版本信息以此时点为准。

---

## 1. Three.js 最新版本选型与体素/Chunk 渲染

### 1.1 版本信息

| 项目 | 版本 |
|------|------|
| Three.js | **0.184.0** (latest stable) |
| @types/three | 0.184.0 |
| Vite | 8.0.10 |
| Webpack | 5.106.2 |

### 1.2 Three.js 0.184 关键特性

- **WebGPU 渲染器**：通过 `import * as THREE from 'three/webgpu'` 原生支持，可作为 WebGL 的性能升级路径（桌面 Chrome/Edge 起步）。
- **Three.js Shading Language (TSL)**：`./tsl` 子路径，提供声明式着色器编写能力。
- **InstancedMesh**：成熟的实例化渲染 API，对体素场景（大量相同方块）至关重要。
- **BufferGeometryUtils.mergeGeometries()**：位于 `three/addons`，将多个 BoxGeometry 合并为单个几何体——静态世界的核心优化手段。
- **依赖**：零运行时依赖，纯 JavaScript/WebGL/WebGPU 库。

### 1.3 体素/Chunk 渲染策略

本项目核心场景是教学场景（餐厅、诊所等），特点是：
- 地图规模可控（小空间，非开放世界）
- 场景相对静态（预定义方块布局）
- 少量 NPC 实体需要独立移动

**推荐方案：Chunk + Geometry Merge + 静态场景分离**

```
World
├── Static Terrain (合并几何体，单次 Draw Call)
│   ├── Floor chunk (草地/地板)
│   ├── Wall chunks (墙壁)
│   └── Furniture blocks (桌椅等道具)
├── Dynamic Entities (独立 Mesh/InstancedMesh)
│   ├── NPC 实体 (带交互能力)
│   └── 可拾取道具
└── Transparent Layer (面剔除优化)
    └── 内部不可见面自动剔除
```

**核心优化技术（按优先级）：**

1. **`BufferGeometryUtils.mergeGeometries()`**：
   ```typescript
   import * as THREE from 'three';
   import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

   // 将同材质的所有方块几何体合并为一个
   const geometries: THREE.BoxGeometry[] = [];
   for (const block of chunkBlocks) {
     const geo = new THREE.BoxGeometry(1, 1, 1);
     geo.translate(block.x, block.y, block.z);
     geometries.push(geo);
   }
   const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
   const mesh = new THREE.Mesh(merged, atlasMaterial);
   ```

2. **面剔除（Face Culling）**：合并前检测相邻方块，剔除内部共享面——`mergeGeometries` 不支持自动剔除，需自定义预处理。

3. **纹理图集（Texture Atlas）**：所有方块纹理打包到单张纹理图集，减少材质切换。

4. **InstancedMesh**（用于动态方块/NPC 标记）：
   ```typescript
   const boxGeo = new THREE.BoxGeometry(1, 1, 1);
   const instancedMesh = new THREE.InstancedMesh(boxGeo, material, count);
   // 通过 matrix 控制每个实例的位置
   dummy.position.set(x, y, z);
   dummy.updateMatrix();
   instancedMesh.setMatrixAt(index, dummy.matrix);
   ```

5. **WebGPU 可选路径**：`import * as THREE from 'three/webgpu'`，条件加载：
   ```typescript
   let renderer;
   if ('gpu' in navigator) {
     const { WebGPURenderer } = await import('three/webgpu');
     renderer = new WebGPURenderer();
   } else {
     renderer = new THREE.WebGLRenderer({ antialias: true });
   }
   ```

### 1.4 Three.js 官方体素示例参考

Three.js 官方手册包含 `threejs-voxel-geometry.js` 辅助文件，演示了 `mergeGeometries` 合并方块体素的方法。关键代码片段：
- 用 `BoxGeometry(1,1,1)` + `applyMatrix4(makeTranslation(x,y,z))` 逐个添加到 geometries 数组
- 用 `BufferGeometryUtils.mergeGeometries(geometries, false)` 合并
- 用 `wireframe: true` 调试可见面

**参考来源**：`https://github.com/mrdoob/three.js/blob/dev/manual/resources/threejs-voxel-geometry.js`

### 1.5 性能基准预期

| 场景规模 | 方案 | 预期帧率 (桌面Chrome) |
|----------|------|----------------------|
| 餐厅 (~500 方块) | 合并几何体 | 60fps ✅ |
| 诊所 (~800 方块) | 合并几何体 | 60fps ✅ |
| 学校走廊 (~2000 方块) | 合并几何体 | 55-60fps ✅ |
| 开放广场 (~5000 方块) | 合并+视锥剔除 | 45-55fps ⚠️ |
| iPad (所有场景) | 合并+简化材质 | 待评估 ⚠️ |

V1 教学场景（餐厅/诊所）规模在 1000 方块以内，无需高级优化。

---

## 2. GLM-ASR API 集成方案（智谱 AI）

### 2.1 API 基本信息

| 参数 | 详情 |
|------|------|
| 模型名称 | `glm-asr` |
| 官方文档 | https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr |
| API 文档 | https://open.bigmodel.cn/dev/api/audio/glm-asr |
| 定价 | **0.06 元/分钟**（音频时长） |
| SDK | `zai-sdk>=0.2.2` (Python) / `ai.z.openapi:zai-sdk:0.3.3` (Java) |
| 音频格式 | WAV |
| 支持语言 | 中文、英语、8 种中国方言 |
| 流式支持 | ✅ `stream=True`，事件类型 `transcript.text.delta` |
| 速率限制 | 按并发请求数（非 RPM），不同等级用户有不同保障 |

### 2.2 核心能力

- **上下文智能理解**：结合上下文语境优化转录输出，提升文本流畅性
- **强抗噪性能**：在非语言类噪声（机械声、环境杂音）下保持高精度识别
- **多语言覆盖**：英语 + 中文 + 8 种方言（东北官话、胶辽官话、北京官话、冀鲁官话、中原官话、江淮官话、兰银官话、西南官话）

### 2.3 集成架构（浏览器端场景引擎）

```
┌──────────────────────────────────────────────────┐
│                    Browser                        │
│  ┌─────────────┐    ┌─────────────────────────┐  │
│  │ Microphone   │    │ MediaRecorder API       │  │
│  │ Button (UI)  │───▶│ (WAV encoding)          │  │
│  └─────────────┘    └───────────┬─────────────┘  │
│                                 │                 │
│                    Audio Blob   │                 │
│                                 ▼                 │
│  ┌──────────────────────────────────────────────┐ │
│  │          ASR Client (browser-side)            │ │
│  │  POST /api/asr  →  Backend Server            │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│              Backend Server (Node.js)             │
│  ┌────────────────────────────────────────────┐  │
│  │ POST /api/asr                               │  │
│  │  → 转发音频到 GLM-ASR API                   │  │
│  │  → 返回转写文本给浏览器                     │  │
│  └────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│      智谱 AI GLM-ASR API (open.bigmodel.cn)      │
│  POST /api/paas/v4/audio/transcriptions          │
│  model: "glm-asr"                                │
│  file: <WAV binary>                              │
│  stream: true/false                              │
└──────────────────────────────────────────────────┘
```

### 2.4 后端代理实现（Node.js/TypeScript）

```typescript
// server/api/asr.ts
import { Hono } from 'hono';

const app = new Hono();

app.post('/api/asr', async (c) => {
  const formData = await c.req.formData();
  const audioFile = formData.get('audio') as File;

  // 转发到智谱 GLM-ASR
  const zhipuResponse = await fetch(
    'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
      },
      body: (() => {
        const fd = new FormData();
        fd.append('model', 'glm-asr');
        fd.append('file', audioFile);
        fd.append('stream', 'false'); // push-to-talk 模式用非流式
        return fd;
      })(),
    }
  );

  const result = await zhipuResponse.json();
  // result.choices[0].message.content → 转写文本
  return c.json({
    text: result.choices[0].message.content,
    usage: result.usage,
  });
});
```

### 2.5 浏览器端录音集成

```typescript
// src/engine/asr.ts
export class ASRClient {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,       // GLM-ASR 推荐采样率
        channelCount: 1,          // 单声道
        echoCancellation: true,   // 回声消除（安静环境可关）
        noiseSuppression: true,   // 降噪
      }
    });

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    this.audioChunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject('Not recording');

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        // 需要转换为 WAV 或由后端转换
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await fetch('/api/asr', {
          method: 'POST',
          body: formData,
        });

        const { text } = await response.json();
        resolve(text);
      };

      this.mediaRecorder.stop();
      // 释放麦克风
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    });
  }
}
```

### 2.6 关键风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **儿童英语 WER 未知** | 高——转写不准则意图路由失效 | **V1 前必须做 Gating**：收集 50+ 条 6-12 岁中国儿童英语语音样本做 benchmark |
| **安静场景下短句识别** | 低——push-to-talk 模式可控 | 已在需求中明确为安静环境短句 |
| **API 并发限制** | 中——多用户同时使用时排队 | 后端实现请求队列，超时 10s 降级 |
| **浏览器音频格式转换** | 低——WebM → WAV | 后端或 WASM 转换 |

---

## 3. Kitten TTS WebAssembly 浏览器集成

### 3.1 模型信息

| 参数 | 详情 |
|------|------|
| 模型 | Kitten TTS Nano v0.1 |
| 参数规模 | **15M** |
| ONNX 模型大小 | **~24MB**（量化版） |
| 原始模型 | [KittenML/KittenTTS](https://github.com/KittenML/KittenTTS) |
| HuggingFace | [KittenML/kitten-tts-nano-0.1](https://huggingface.co/KittenML/kitten-tts-nano-0.1) |
| 开源协议 | Apache 2.0 |
| 参考实现 | [clowerweb/kitten-tts-web-demo](https://github.com/clowerweb/kitten-tts-web-demo) (93★) |

### 3.2 能力矩阵

- **8 种不同语音**：男声/女声，多种表情风格
- **语速可调**：0.5x - 2.0x（对 ESL 学习者至关重要——低龄段用 0.7x-0.8x）
- **多采样率**：8kHz - 48kHz（模型原生 24kHz 输出）
- **100% 浏览器端运行**：零网络依赖，零延迟
- **WebGPU 加速（实验性）**：WASM 自动回退
- **实时生成速度**：~2-3x 实时

### 3.3 技术架构

```
┌────────────────────────────────────────────────────────┐
│                     Main Thread                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ TTSManager                                       │  │
│  │  - postMessage({ type:'init' })                  │  │
│  │  - postMessage({ text, voice, speed })           │  │
│  │  - onmessage → 接收 Audio Blob → Web Audio API    │  │
│  └──────────────────────────────────────────────────┘  │
│                         │ postMessage                   │
│                         ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Web Worker (tts-worker.ts)           │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ KittenTTS.from_pretrained(modelPath)       │  │  │
│  │  │  → ONNX Runtime Web InferenceSession       │  │  │
│  │  │     ├─ WebGPU (try first, fallback WASM)   │  │  │
│  │  │     └─ WASM (simd: true)                   │  │  │
│  │  ├────────────────────────────────────────────┤  │  │
│  │  │ TextSplitterStream → chunkText(text)       │  │  │
│  │  │ tokenizeText() → phonemize(text, 'en-us')  │  │  │
│  │  │   → vocab lookup → token IDs               │  │  │
│  │  ├────────────────────────────────────────────┤  │  │
│  │  │ session.run({                              │  │  │
│  │  │   input_ids, style, speed                  │  │  │
│  │  │ }) → waveform Float32Array                 │  │  │
│  │  ├────────────────────────────────────────────┤  │  │
│  │  │ normalizePeak() → trimSilence()            │  │  │
│  │  │ → RawAudio.toBlob() (WAV)                  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                         ▲
                         │ IndexedDB
┌────────────────────────────────────────────────────────┐
│              ModelCache (IndexedDB)                     │
│  - 7 天 TTL                                            │
│  - model_quantized.onnx (~24MB)                        │
│  - tokenizer.json                                      │
│  - voices.json (8 种语音嵌入)                           │
│  - ONNX Runtime WASM 文件                               │
└────────────────────────────────────────────────────────┘
```

### 3.4 集成代码（引擎 TTS 模块）

```typescript
// src/engine/tts.ts
export type TTSSpeakerVoice = 'expr-voice-2-m' | 'expr-voice-3-f' | /* ... 8 voices */;

export interface TTSOptions {
  voice?: TTSSpeakerVoice;
  speed?: number; // 0.5 - 2.0, default 1.0
  sampleRate?: number; // default 24000
}

export class TTSEngine {
  private worker: Worker;
  private ready: Promise<void>;

  constructor() {
    this.worker = new Worker(
      new URL('../workers/tts-worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.ready = new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        if (e.data.status === 'ready') {
          console.log(`TTS ready, voices: ${e.data.voices.length}, device: ${e.data.device}`);
          resolve();
        }
      };
    });

    this.worker.postMessage({ type: 'init', useWebGPU: false });
  }

  async speak(text: string, options: TTSOptions = {}): Promise<HTMLAudioElement> {
    await this.ready;

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        if (e.data.status === 'complete') {
          const blob = e.data.audio;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          resolve(audio);
        } else if (e.data.status === 'error') {
          reject(new Error(e.data.data));
        }
      };

      this.worker.postMessage({
        text,
        voice: options.voice || 'expr-voice-2-m',
        speed: options.speed || 1.0,
        sampleRate: options.sampleRate || 24000,
      });
    });
  }
}
```

### 3.5 Vite 配置要点（ONNX Runtime Web 兼容）

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.wasm'],        // WASM 文件作为静态资源
  worker: { format: 'es' },            // Web Worker 使用 ES 模块
  build: { target: 'esnext' },         // 现代浏览器
  plugins: [
    {
      name: 'onnx-wasm-plugin',
      configureServer(server) {
        // 处理 ONNX 运行时 WASM 文件的 ?import 参数
        server.middlewares.use('/onnx-runtime', (req, res, next) => {
          if (req.url?.includes('?import')) {
            req.url = req.url.replace('?import', '');
          }
          if (req.url?.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript');
          }
          next();
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],       // 不预构建 ONNX
  },
});
```

### 3.6 关键依赖

```json
{
  "onnxruntime-web": "^1.22.0",
  "phonemizer": "^1.2.1"
}
```

### 3.7 待评估风险

| 风险 | 影响 | 评估方向 |
|------|------|----------|
| **音色自然度** | 儿童需要亲和、自然的声音，机械音会降低沉浸感 | 试听 8 种语音，测试 6-12 岁目标用户接受度 |
| **多音色支持** | 不同 NPC 需要不同声音 | 8 种语音是否足够区分 NPC？是否需要微调？ |
| **模型加载时间** | 24MB 首次下载 | IndexedDB 缓存后二次加载为 0，首次需 5-10 秒（取决于网络） |
| **中文支持** | Kitten TTS 原生英语 | 新概念英语场景 NPC 说英语，不要求中文 TTS |
| **浏览器兼容性** | WASM 要求 | Chrome/Edge 桌面版完全支持，移动端需验证 |

---

## 4. DeepSeek V4 Flash API — 意图分类/路由

### 4.1 API 基本信息

| 参数 | 详情 |
|------|------|
| 模型名称 | **`deepseek-v4-flash`**（兼容名：`deepseek-chat` 用于非思考模式） |
| API Base URL | `https://api.deepseek.com`（OpenAI 兼容格式） |
| 文档 | https://api-docs.deepseek.com |
| 上下文窗口 | **1M tokens** 输入 |
| 最大输出 | **32K tokens** |
| 思考模式 | 支持 thinking / non-thinking（默认 thinking） |
| 结构化输出 | ✅ `response_format: { type: "json_object" }` |
| 函数调用 | ✅ Tool Calls（最多 128 个函数） |
| 上下文缓存 | ✅ Context Caching（缓存命中 $0.03625/1M tokens） |

### 4.2 定价

| 维度 | 价格（每 1M tokens） |
|------|---------------------|
| 输入（缓存未命中） | $0.435（限时 75% off） |
| 输入（缓存命中） | $0.03625（限时 75% off） |
| 输出 | $0.87（限时 75% off） |

> ⚠️ 限时折扣至 **2026/05/05 15:59 UTC**，之后恢复原价。原价约为此价格的 4 倍。

### 4.3 意图路由集成模式

需求的核心：将 ASR 转写文本 + 对话上下文 + 场景候选意图 → LLM 判定匹配的意图（或 `none`）

```typescript
// src/engine/intent-router.ts

export interface CandidateIntent {
  key: string;           // 场景内唯一标识
  description: string;   // 自然语言描述（如 "孩子点了某样食物或饮料"）
}

export interface IntentResult {
  intent: string | null;  // 匹配的意图 key，或 null（"none"）
  confidence: number;     // 0.0 - 1.0
  reasoning?: string;     // LLM 的判定理由（可选，用于调试）
}

export class IntentRouter {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async classify(
    asrText: string,
    context: string,
    candidates: CandidateIntent[],
  ): Promise<IntentResult> {
    // 构建候选意图描述
    const intentDescriptions = candidates
      .map(c => `- "${c.key}": ${c.description}`)
      .join('\n');

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for a children's English learning game (ages 6-12).
A child spoke into the microphone. Your job is to match what they said to one of the candidate intents.

IMPORTANT RULES:
1. Children's English may have grammar errors and pronunciation issues - focus on MEANING, not correctness.
2. If the child's utterance reasonably matches an intent's description, classify it as that intent.
3. If the child said something completely unrelated (non-English, nonsense, silence), return "none".
4. Be generous with children - if they tried to communicate the intent, give them credit.

Candidate intents:
${intentDescriptions}

Respond with a JSON object: {"intent": "<intent_key or 'none'>", "confidence": 0.0-1.0, "reasoning": "<brief explanation>"}`,
          },
          {
            role: 'user',
            content: `Conversation context: ${context}\n\nChild said: "${asrText}"`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,       // 低温度保证一致性
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content) as IntentResult;
  }
}
```

### 4.4 降级策略（R8 要求）

```typescript
export class IntentRouterWithFallback extends IntentRouter {
  private lastCallTime: number = 0;
  private failureCount: number = 0;
  private circuitOpen: boolean = false;

  async classifyWithFallback(
    asrText: string,
    context: string,
    candidates: CandidateIntent[],
  ): Promise<IntentResult> {
    // 熔断器：连续 3 次失败 → 直接走关键词降级
    if (this.circuitOpen) {
      return this.keywordFallback(asrText, candidates);
    }

    try {
      const result = await this.classify(asrText, context, candidates);
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= 3) {
        this.circuitOpen = true;
        // 30 秒后重试 LLM
        setTimeout(() => { this.circuitOpen = false; }, 30000);
      }
      // 降级到关键词+规则匹配
      return this.keywordFallback(asrText, candidates);
    }
  }

  private keywordFallback(
    text: string,
    candidates: CandidateIntent[],
  ): IntentResult {
    const lowerText = text.toLowerCase();

    // 简单关键词匹配（可作为 V1 最小可用版本）
    for (const candidate of candidates) {
      const keywords = this.extractKeywords(candidate.description);
      const matchCount = keywords.filter(kw =>
        lowerText.includes(kw.toLowerCase())
      ).length;

      if (matchCount >= Math.ceil(keywords.length * 0.5)) {
        return {
          intent: candidate.key,
          confidence: matchCount / keywords.length * 0.7, // 标记为降级置信度
          reasoning: 'Fallback: keyword match',
        };
      }
    }

    return { intent: null, confidence: 0 };
  }

  private extractKeywords(description: string): string[] {
    // 从意图描述中提取关键词
    return description
      .toLowerCase()
      .replace(/[，,]/g, ' ')
      .split(' ')
      .filter(w => w.length > 2);
  }
}
```

### 4.5 成本估算（每会话）

| 场景 | 每次 LLM 调用 | 每次交互 |
|------|---------------|----------|
| 输入 tokens | ~500（系统 prompt + 候选意图 + 上下文 + ASR 文本） | ~500 |
| 输出 tokens | ~100（JSON 意图结果） | ~100 |
| 成本 | (500×$0.435 + 100×$0.87) / 1M ≈ **$0.00030** | $0.00030 |
| 10 次交互/会话 | | **$0.003** |
| 1000 会话/天 | | **$3.00** |

> 限时折扣期间成本极低。原价恢复后约 $0.012/会话（1000 会话/天 = $12/天）。

### 4.6 关键特性（对意图路由有价值）

1. **JSON Output Mode**：`response_format: { type: 'json_object' }` 保证结构化输出——意图返回总是可解析的 JSON。
2. **低延迟**：V4 Flash 定位为快模型，push-to-talk 模式下 P95 < 2s 即可接受。
3. **上下文缓存**：系统 prompt（意图描述模板）不变，可利用缓存降低延迟和成本。
4. **非思考模式**：对分类任务，`reasoning_effort: 'minimal'` 可进一步降低延迟。

---

## 5. TypeScript 项目搭建（Three.js + WASM）

### 5.1 推荐项目结构

```
hi-kid-fun/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── onnx-runtime/               # ONNX Runtime WASM 文件
│   │   ├── ort-wasm.wasm
│   │   ├── ort-wasm-threaded.wasm
│   │   └── ort-wasm-simd.wasm
│   └── tts-model/                  # Kitten TTS 模型文件
│       ├── model_quantized.onnx     # ~24MB
│       ├── tokenizer.json
│       └── voices.json             # 8 种语音嵌入
├── src/
│   ├── main.ts                     # 应用入口
│   ├── engine/
│   │   ├── index.ts                # 引擎主入口
│   │   ├── renderer.ts             # Three.js 体素渲染器
│   │   ├── chunk.ts                # Chunk 几何体合并
│   │   ├── tts.ts                  # Kitten TTS 封装
│   │   ├── asr.ts                  # GLM-ASR 客户端
│   │   ├── intent-router.ts        # DeepSeek 意图路由
│   │   ├── scene-loader.ts         # 场景配置加载与校验
│   │   ├── session.ts              # 会话生命周期
│   │   └── scoring.ts              # 计分系统
│   ├── workers/
│   │   └── tts-worker.ts           # TTS Web Worker
│   ├── components/                 # UI 组件
│   │   ├── mic-button.ts           # 按住说话按钮
│   │   ├── score-display.ts        # 得分显示
│   │   └── hint-bubbles.ts         # 提示例句气泡
│   └── types/
│       └── scene-config.ts         # 场景配置 TypeScript 类型
└── server/
    ├── index.ts                    # Hono/Express 后端
    └── api/
        ├── asr.ts                  # ASR 代理
        └── intent.ts               # 意图路由代理（可选）
```

### 5.2 package.json

```json
{
  "name": "hi-kid-fun",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "server": "tsx server/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "three": "^0.184.0",
    "onnxruntime-web": "^1.22.0",
    "phonemizer": "^1.2.1",
    "hono": "^4.x"
  },
  "devDependencies": {
    "@types/three": "^0.184.0",
    "typescript": "^5.7.0",
    "vite": "^8.0.0",
    "tsx": "^4.x"
  }
}
```

### 5.3 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts"],
  "exclude": ["node_modules", "dist", "server"]
}
```

### 5.4 场景配置类型定义（Schema 约束层）

```typescript
// src/types/scene-config.ts

/** NPC 语音配置 */
export interface NPCVoice {
  voice: string;       // Kitten TTS voice key
  speed: number;       // 0.5-2.0
}

/** NPC 对话树节点 */
export interface DialogueNode {
  id: string;
  npcText: string;              // NPC 说什么（经 TTS 播放）
  candidateIntents: CandidateIntentDef[];  // 儿童可能的回应意图
  hintExamples: string[];       // R19: 提示例句气泡（2-3条）
  timeoutMs?: number;           // 等待儿童回应超时
}

export interface CandidateIntentDef {
  intent: string;               // 意图标识
  description: string;          // 自然语言描述，传给 LLM
  nextNode: string;             // 匹配后跳转到哪个对话节点
  score: number;                // 匹配此意图的得分
}

/** NPC 定义 */
export interface NPCDef {
  id: string;
  position: [number, number, number];  // x, y, z
  appearance: string;                  // 外观引用
  voice: NPCVoice;
  dialogueTree: Record<string, DialogueNode>;
  startNode: string;                   // 对话入口节点
  interactRadius: number;              // 交互触发距离
}

/** 任务定义 */
export interface TaskDef {
  id: string;
  trigger: {
    type: 'dialogueComplete' | 'enterZone' | 'npcInitiate';
    nodeId?: string;
    zone?: { center: [number, number, number]; radius: number };
    npcId?: string;
  };
  targetIntent: string;         // 儿童需要表达的意图
  successCriteria: {
    intentMatch: boolean;
    keywordOverrides?: string[];
  };
  rewardPoints: number;
}

/** 方块定义 */
export interface BlockDef {
  type: string;                 // 方块类型（grass, stone, wood, water）
  positions: [number, number, number][];  // 位置列表
}

/** 场景配置（顶层） */
export interface SceneConfig {
  schema: 'hi-kid-fun/v1';
  id: string;
  name: string;
  description: string;
  metadata?: {
    cefrLevel?: string;        // CEFR 级别
    targetVocabulary?: string[];
    prerequisites?: string[];
  };
  world: {
    size: [number, number, number];  // 世界尺寸
    blocks: BlockDef[];
  };
  npcs: NPCDef[];
  tasks: TaskDef[];
  hooks?: {                    // V1: 显式函数 Hook（最小集）
    onSceneLoad?: string;      // Hook 函数名
    onTaskComplete?: string;
  };
}
```

---

## 6. 构建工具选型：Vite vs Webpack

### 6.1 对比矩阵

| 维度 | Vite 8.0 | Webpack 5.106 |
|------|----------|---------------|
| **开发服务器** | 原生 ESM，毫秒级 HMR | 需要打包，HMR 随项目增大变慢 |
| **WASM 支持** | `assetsInclude: ['**/*.wasm']` 简单配置 | `asyncWebAssembly` 实验性配置 |
| **Web Worker** | `worker: { format: 'es' }` 原生支持 | 需 `worker-loader` 或 Webpack 5 内置 |
| **TypeScript** | 开箱即用（仅编译，不检查） | 需 `ts-loader` 或 `babel-loader` |
| **Three.js 兼容性** | 完美——ESM import | 良好但需配置 |
| **ONNX Runtime Web** | ✅ 已验证（kitten-tts-web-demo 使用 Vite 7） | 可以但配置复杂 |
| **构建速度** | 极快（esbuild） | 较慢 |
| **生产构建** | Rollup 打包 | 自研打包器 |
| **生态插件** | 快速增长 | 最成熟 |
| **配置文件复杂度** | 低 | 高 |

### 6.2 推荐：Vite

**理由：**

1. **优先参考实现一致性**：`kitten-tts-web-demo` 使用 Vite，其配置（WASM 处理、ONNX Runtime 兼容、Web Worker）可直接复用——降低集成风险。
2. **体素场景开发需要快速迭代**：Vite 的 HMR 在可视化调试方块布局、NPC 位置时极大提升效率。
3. **WASM 配置极简**：`assetsInclude: ['**/*.wasm']` 一行搞定。
4. **Web Worker 原生支持**：`new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` 零配置。
5. **Three.js 官方推荐 ESM import**：`import * as THREE from 'three'` 与 Vite 设计天然契合。

### 6.3 完整 Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.wasm'],
  worker: { format: 'es' },
  build: {
    target: 'esnext',
  },
  plugins: [
    {
      name: 'onnx-wasm-headers',
      configureServer(server) {
        // ONNX Runtime WASM 需要正确的 MIME 类型
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          }
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',  // 后端服务器
        changeOrigin: true,
      },
    },
  },
});
```

### 6.4 何时考虑 Webpack

如果未来 V1 后出现以下需求，再评估迁移：
- 需要复杂的 code splitting 策略（Vite 基于 Rollup 也支持，但不如 Webpack 灵活）
- 需要 Module Federation（微前端）
- 团队已有深度 Webpack 定制经验

---

## 7. 整体架构总结

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Desktop Chrome/Edge)         │
│                                                         │
│  ┌────────────────── HiKid.Fun ───────────────────────┐ │
│  │                                                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │ │
│  │  │ Three.js  │  │ Kitten   │  │ Intent Router    │  │ │
│  │  │ Voxel     │  │ TTS      │  │ (DeepSeek V4     │  │ │
│  │  │ Renderer  │  │ (WASM)   │  │  Flash via API)  │  │ │
│  │  └──────────┘  └──────────┘  └────────┬─────────┘  │ │
│  │       ▲              ▲                │            │ │
│  │       │              │                │            │ │
│  │  ┌────┴──────────────┴────────────────┴──────────┐ │ │
│  │  │              Scene Lifecycle                    │ │ │
│  │  │  idle → active → task-in-progress → complete   │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
│                         │                                │
│                    POST /api/*                            │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│              Backend Server (Node.js + Hono)             │
│                                                         │
│  POST /api/asr  ──▶  GLM-ASR API (open.bigmodel.cn)     │
│  POST /api/intent ──▶ DeepSeek API (api.deepseek.com)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**核心设计原则：**
- **TTS 离线**（WASM）：零延迟、零网络依赖
- **ASR 云端**（GLM-ASR）：push-to-talk 异步模式
- **意图路由云端**（DeepSeek V4 Flash）：JSON 结构化输出，低温度确定性分类
- **体素渲染本地**（Three.js 0.184）：合并几何体批量渲染
- **构建工具 Vite**：快速迭代、原生 WASM/Worker 支持

---

## 8. 待研究/待验证清单（转 Planning）

| # | 问题 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | GLM-ASR 对 6-12 岁中国儿童英语 WER benchmark | **P0** | 需收集 50+ 样本 |
| 2 | Kitten TTS 音色自然度（儿童场景） | **P0** | 需试听评估 |
| 3 | DeepSeek V4 Flash 意图路由 P95 延迟 | **P1** | 需实测 |
| 4 | 场景配置声明式覆盖率验证（5 场景） | **P1** | V1 后执行 |
| 5 | Three.js + ONNX 在 iPad/移动端性能 | **P2** | 移动端后置 |
| 6 | V1 硬编码餐厅场景 → 验证「引擎=约束层」模型 | **P0** | V1 核心目标 |
| 7 | 场景配置 schema 格式（JSON Schema / YAML / TS 类型） | **P1** | 设计阶段决定 |
| 8 | Hook DSL 设计（推迟到 3+ 场景验证后） | **P2** | V1 仅显式函数 Hook |

---

## 参考文献

- Three.js 0.184.0: https://www.npmjs.com/package/three/v/0.184.0
- Three.js Manual (Voxel Geometry): https://github.com/mrdoob/three.js/blob/dev/manual/resources/threejs-voxel-geometry.js
- GLM-ASR 文档: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr
- Kitten TTS Web Demo: https://github.com/clowerweb/kitten-tts-web-demo
- KittenML/KittenTTS: https://github.com/KittenML/KittenTTS
- DeepSeek API 文档: https://api-docs.deepseek.com
- DeepSeek 模型定价: https://api-docs.deepseek.com/quick_start/pricing
- ONNX Runtime Web: https://www.npmjs.com/package/onnxruntime-web
