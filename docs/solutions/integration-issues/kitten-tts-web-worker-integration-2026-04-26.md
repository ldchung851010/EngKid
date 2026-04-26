---
title: Kitten TTS ONNX Web Worker 集成 — 7 个坑与修复
date: 2026-04-26
category: integration-issues
module: voice-engine
problem_type: integration_issue
component: tooling
symptoms:
  - "Kitten TTS ONNX 模型加载成功但无音频输出"
  - "ONNX Runtime 报错：input 'style' is missing in 'feeds'"
  - "从 HuggingFace 下载模型文件 404（文件名与预期不符）"
  - "Voice embedding 加载后推理输出 NaN 或静音波形"
  - "ONNX Runtime Web 因 WASM 文件未部署而崩溃"
severity: high
root_cause: incomplete_setup
resolution_type: environment_setup
tags: [kitten-tts, onnx-runtime-web, web-worker, tts, phonemizer, three-js, wasm]
---

# Kitten TTS ONNX Web Worker 集成 — 7 个坑与修复

## 问题

在浏览器端通过 Web Worker 集成 Kitten TTS（ONNX 推理）生成语音，模型加载看似成功但无音频输出。从模型文件获取到依赖安装、再到输入张量格式，共踩了 7 个坑才跑通完整链路。

## 症状

- ONNX Runtime 警告 `Some nodes were not assigned to the preferred execution providers`（实际无害，但容易误判为问题）
- `Error: input 'style' is missing in 'feeds'` —— 传给模型的张量名不对
- `huggingface_hub` 下载返回 404 —— 实际文件名与文档不一致
- 推理执行无报错，但输出波形全为 NaN 或接近 0
- ONNX Runtime Web 崩溃 —— WASM 文件路径未配置

## 排查与失败的尝试

**尝试 1：把原始文本字节直接当 `input_ids` 送进模型**
用 `TextEncoder.encode(text)` 生成的字节直接作为 `input_ids` 张量。模型推理不报错，但输出为无效音频。Kitten TTS 的 ONNX 模型实际期望**音素 token ID**，不是 UTF-8 字节。

**尝试 2：把 voice embedding 当一维数组**
`voices.json` 结构是 `{ "voice-name": [[256 floats]] }` —— 真正的 embedding 是内层 256 维向量。`new Float32Array(embedding)` 把外层包装展开成了错误的 [1] 维张量。

**尝试 3：用浏览器 SpeechSynthesis 兜底**
TTS 引擎在 `speak()` 前检查 `isReady` 状态，而 `init()` 永远因模型文件缺失报错，导致 `isReady` 恒为 `false`，兜底路径永远走不到。架构死锁：fallback 被 primary 的成功门槛堵死。

## 解决方案

按排查顺序，共 7 个修复：

### 1. HuggingFace 仓库实际文件名与文档不同

仓库 `KittenML/kitten-tts-nano-0.1` 的实际文件：
- `kitten_tts_nano_v0_1.onnx`（不是 `model_quantized.onnx`）
- `voices.npz`（不是 `voices.json`，是 NumPy 格式需转换）
- `config.json`（元数据，不含模型数据）
- **没有 `tokenizer.json`**（必须从别处获取）

用 Python `huggingface_hub` 库下载正确文件名，重命名 ONNX，把 `voices.npz` 转成 JSON：

```python
from huggingface_hub import hf_hub_download
import numpy as np, json

hf_hub_download('KittenML/kitten-tts-nano-0.1', 'kitten_tts_nano_v0_1.onnx', local_dir='public/tts-model/')
hf_hub_download('KittenML/kitten-tts-nano-0.1', 'voices.npz', local_dir='public/tts-model/')

os.rename('public/tts-model/kitten_tts_nano_v0_1.onnx', 'public/tts-model/model_quantized.onnx')

data = np.load('public/tts-model/voices.npz')
voices = {key: data[key].tolist() for key in data.files}
json.dump(voices, open('public/tts-model/voices.json', 'w'))
```

### 2. Voice embedding 是嵌套数组，需要取内层

```json
{ "expr-voice-2-m": [[0.112, 0.021, ...256 个 float...]] }
```

```typescript
// ❌ 错误 —— 取了外层 wrapper，只拿到 [1] 维
voices[key] = new Float32Array(embedding as number[]);

// ✅ 正确 —— 取内层 256 维向量
voices[key] = new Float32Array((embedding as number[][])[0]);
```

### 3. ONNX 模型真正的输入/输出张量名

用 Python 检查模型签名再写代码：

```python
import onnx
model = onnx.load("model_quantized.onnx")
for inp in model.graph.input:
    print(f"  {inp.name}: {[d.dim_value for d in inp.type.tensor_type.shape.dim]}")
for out in model.graph.output:
    print(f"  {out.name}: {[d.dim_value for d in out.type.tensor_type.shape.dim]}")
```

**实际输入：** `input_ids: [1, variable]`、`style: [1, 256]`、`speed: [1]`
**实际输出：** `waveform`（不是 `audio`）

```typescript
const feeds = {
  input_ids: new ort.Tensor('int64', tokenIds, [1, tokenIds.length]),
  style: new ort.Tensor('float32', speakerEmbedding, [1, 256]),     // 不是 voice_embedding
  speed: new ort.Tensor('float32', new Float32Array([speed]), [1]),
};
const results = await session.run(feeds);
const audioData = new Float32Array(results.waveform.data);           // 不是 results.audio
```

### 4. 文本必须经过 phonemize → tokenize 流水线

Kitten TTS 的 ONNX 模型吃的是**音素 token ID**，不是原始文本字节。完整流水线：

```
英文文本 → cleanTextForTTS() → chunkText() → phonemize("en-us") → "$phonemes$" → vocab 查表 → BigInt64Array
```

依赖：
```bash
npm install phonemizer
```

Worker 中的实现：
```typescript
async function tokenize(text: string): Promise<BigInt64Array> {
  const { phonemize } = await import('phonemizer');
  const phonemes = await phonemize(text, 'en-us');
  const chars = `$${phonemes}$`.split('');
  const ids = chars.map((ch) => vocab[ch] ?? 0);
  return BigInt64Array.from(ids.map((n) => BigInt(n)));
}
```

### 5. tokenizer.json 不在模型仓库中

`KittenML/kitten-tts-nano-0.1` 不包含 `tokenizer.json`。参考实现 `kitten-tts-web-demo` 的 `public/tts-model/` 中有此文件，直接复制过来。

### 6. ONNX Runtime Web 的 WASM 文件

`onnxruntime-web` 需要三个 WASM 运行时文件部署在可访问的路径：

- `ort-wasm-simd-threaded.jsep.wasm`
- `ort-wasm-simd-threaded.jsep.mjs`
- `ort.bundle.min.mjs`

从参考实现复制到 `public/onnx-runtime/`，并在 Worker 中配置路径：

```typescript
ort = await import('onnxruntime-web');
ort.env.wasm.wasmPaths = '/onnx-runtime/';
```

### 7. Vite 配置适配 ONNX Runtime

ONNX Runtime Web 内部动态加载模块时会在 URL 后追加 `?import`，Vite 默认会拦截这个请求。参考 `kitten-tts-web-demo` 的 vite.config.js，需要：

```typescript
// vite.config.ts
export default defineConfig({
  worker: { format: 'es' },
  build: { target: 'esnext' },
  assetsInclude: ['**/*.wasm'],
  plugins: [{
    name: 'onnx-wasm-plugin',
    configureServer(server) {
      server.middlewares.use('/onnx-runtime', (req, _res, next) => {
        if (req.url?.includes('?import')) req.url = req.url.replace('?import', '');
        next();
      });
    },
  }],
});
```

## 原理

Kitten TTS 的 ONNX 模型是一个**音素级文本转语音**模型。完整链路：

```
英文文本 → 清理（去 emoji、规范化标点）
  → 分句（按句子拆分）
  → 音素化（phonemizer 转 IPA 音素）
  → Tokenize（音素字符 → vocab ID）
  → ONNX 推理（音素 token + style embedding + speed → 波形采样）
  → 后处理（NaN 清除、峰值归一化、语速调整）
  → WAV 播放
```

7 个坑分别打断了这条链路的不同环节。

## 预防

- **先检查 ONNX 模型签名再写代码。** 用 `python -c "import onnx; ..."` 查看输入/输出张量名和形状，不要凭猜测。
- **检查 JSON 数据结构再假设数组形状。** HuggingFace 的 embedding 常用 `[[data]]` 嵌套格式。
- **从可运行的参考实现完整复制文件。** 模型仓库不一定包含 `tokenizer.json`、WASM 运行时等外围文件。优先以 demo 的文件清单为准。
- **不要把 fallback 路径关在 primary 成功的门后面。** `isReady` 检查使得 `SpeechSynthesis` 兜底永远不可达。要么默认走 fallback，要么用独立 readiness flag。

## 相关

- Kitten TTS Web Demo：https://github.com/clowerweb/kitten-tts-web-demo
- HuggingFace 模型：https://huggingface.co/KittenML/kitten-tts-nano-0.1
- ONNX Runtime Web：https://www.npmjs.com/package/onnxruntime-web
- Phonemizer：https://www.npmjs.com/package/phonemizer
