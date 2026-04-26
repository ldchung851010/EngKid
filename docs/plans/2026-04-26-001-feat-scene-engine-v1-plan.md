---
title: feat: Build scene-engine — Three.js voxel English learning engine
type: feat
status: active
date: 2026-04-26
origin: docs/brainstorms/2026-04-26-scene-engine-requirements.md
---

# 场景引擎 — V1 实现规划

## Overview

构建一个基于 Three.js 的体素场景引擎，为 6-12 岁儿童提供沉浸式英语口语学习体验。引擎封装渲染、语音管线、意图路由、计分、会话生命周期，场景作者（人或 AI）通过声明式配置定义新场景。

V1 目标：一个硬编码的餐厅场景跑通全链路，验证「引擎 = 约束层」模型是否成立。

---

## Problem Frame

现有儿童英语 App 留存差（玩两天就丢），线下培训课时少、开口机会远不足。通过体素 3D 世界承载新概念英语场景，儿童在其中自由探索、按 Push-to-Talk 与 NPC 对话，在游戏中自然开口。引擎提供场景的「语法约束层」，使 AI 可稳定生成新场景。

---

## Requirements Trace

- R1. Minecraft 风格体素 3D 世界渲染，第一人称/第三人称自由视角
- R2. 原子方块类型（地形、道具、NPC 实体）
- R3. 会话状态机：`idle → active → task-in-progress → task-complete → session-end`
- R4. 场景加载/卸载/切换，保留计分上下文
- R5. TTS 语音合成：浏览器端 WebAssembly 离线方案（Kitten TTS）
- R6. ASR 语音识别：Push-to-Talk 模式，云端 GLM-ASR-2512（智谱）
- R7. 意图路由器：ASR 文本 + 上下文 + 候选意图 → LLM（DeepSeek V4 Flash）→ 意图匹配
- R8. LLM 降级策略：关键词+规则兜底；`none` 时 LLM 生成引导提问，最多 3 次重试
- R9. 计分维度：任务完成、尝试次数、用词正确性
- R10. 会话内计分，会话结束展示得分
- R11. 场景 = 声明式配置 + 可选 Hook
- R12. Schema 校验，拒绝非法配置并返回字段级错误
- R13. NPC 定义：位置、外观、对话树、语音配置、交互触发条件
- R14. 任务定义：触发条件、目标意图、成功标准、奖励积分
- R15. Hook 机制：V1 仅 2-3 个显式函数 Hook，DSL 推迟
- R16. 配置加载时完整校验，字段级错误含路径
- R17. Scene API：`register()`, `activate()`, `getActiveScene()`
- R18. 无头测试模式：脱离 WebGL 校验配置 + 驱动对话逻辑
- R19. 麦克风按钮旁展示 2-3 个提示例句气泡

**Origin actors:** A1（儿童学习者 6-12 岁）, A2（场景作者/教师）, A3（AI 场景生成器）  
**Origin flows:** F1（学习会话）, F2（场景定义）, F3（AI 生成场景）  
**Origin acceptance examples:** AE1（餐厅场景完整交互）, AE2（Schema 校验拒绝非法配置）, AE3（会话状态转换 + 跨场景计分保留）, AE4（诊所场景 NPC + 任务定义）

---

## Scope Boundaries

### Deferred for later

- 多人联机/同伴对话练习模式
- NPC 口型动画 / 角色表情同步
- AR / VR 设备支持
- 场景内容市场 / 社区分享平台
- 家长/教师后台数据看板与学习分析
- 课程序列编排

### Outside this product's identity

- 通用游戏引擎：不支持物理模拟、粒子特效、骨骼动画
- 课程管理系统：不负责跨场景教学编排
- 语音评测平台：只做用词正确性检查，不做逐音节纠音

### Deferred to Follow-Up Work

- Greedy meshing 渲染优化（V2）
- 移动端兼容性适配（V2）
- 教师自服务场景创作工具（V2）
- Hook DSL 设计与实现（3+ 场景验证后）

---

## Context & Research

### Technology Stack (Final)

| 层 | 方案 | 版本 | 部署 |
|---|---|---|---|
| 渲染 | Three.js + InstancedMesh | 0.184.0 | 浏览器 |
| TTS | Kitten TTS (ONNX Runtime Web) | 15M param / ~24MB | WebAssembly / Web Worker |
| ASR | GLM-ASR-2512 (智谱 AI) | `glm-asr-2512` | 云端（后端代理） |
| LLM 意图路由 | DeepSeek V4 Flash | OpenAI 兼容 API | 云端（后端代理） |
| 状态机 | XState v5 | latest | 浏览器 |
| 构建 | Vite + TypeScript | latest | — |
| 后端代理 | Fastify + TypeScript | latest | Node.js |

### Voxel Rendering Pattern

V1 使用单 chunk（可配置尺寸，V1 最大 32×16×32）+ InstancedMesh per block type + face culling。每个方块类型共享一个 BoxGeometry，通过 `InstancedMesh.setMatrixAt()` 放置实例——单 draw call 渲染同一类型的全部方块。仅渲染邻居为 AIR 的面。NPC 为独立 Mesh 对象（需动画/旋转）。

### Voice Pipeline Architecture

```
Push-to-Talk 按钮 (pointerdown/up)
  → MediaRecorder (audio/webm;codecs=opus, 16kbps)
  → 释放 → Blob → 后端代理 → GLM-ASR-2512
  → ASR 文本 → 后端代理 → DeepSeek V4 Flash
  → {intentId, confidence} → 引擎推进对话树
  → NPC 文本 → Web Worker → Kitten TTS → AudioContext.play()
```

GLM-ASR-2512 和 DeepSeek 都通过后端代理调用，避免浏览器端暴露 API Key。

### Institutional Learnings

无——绿场项目，首个规划。本次实现将成为后续 `ce-compound` 的初始知识条目。

### External References

- Kitten TTS Web Demo: https://github.com/clowerweb/kitten-tts-web-demo（Web Worker + ONNX Runtime Web 完整参考实现）
- GLM-ASR-2512 API: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr-2512
- Three.js InstancedMesh: https://threejs.org/docs/#api/en/objects/InstancedMesh
- XState v5: https://stately.ai/docs/xstate

---

## Output Structure

```
scene-engine/
├── index.html                  # V1 入口页面
├── package.json
├── tsconfig.json
├── vite.config.ts
├── server/                     # 后端代理（API Key 保护）
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Fastify 服务入口
│       └── routes/
│           ├── asr.ts          # POST /api/asr — GLM-ASR-2512 代理
│           └── intent.ts       # POST /api/intent — DeepSeek 代理
├── src/
│   ├── index.ts                # 引擎公共入口 + Scene API
│   ├── engine/
│   │   ├── runtime/
│   │   │   ├── SessionMachine.ts    # XState v5 会话状态机 (U6)
│   │   │   ├── SceneLoader.ts       # 场景配置加载 + 校验 (U3)
│   │   ├── renderer/
│   │   │   ├── VoxelWorld.ts        # 体素世界管理 (U2)
│   │   │   ├── ChunkBuilder.ts      # InstancedMesh 构建
│   │   │   ├── BlockTypes.ts        # 方块类型定义 + 纹理映射
│   │   │   └── CameraController.ts  # 第一/第三人称相机
│   │   ├── voice/
│   │   │   ├── TTSEngine.ts         # Kitten TTS Web Worker 封装 (U4)
│   │   │   ├── SpeechPipeline.ts    # Push-to-Talk → ASR → Intent 流水线 (U5)
│   │   │   ├── IntentRouter.ts      # DeepSeek 意图路由 + 降级
│   │   │   └── MicButton.ts         # 麦克风按钮 + 提示气泡 UI (U7)
│   │   ├── scoring/
│   │   │   └── ScoreTracker.ts      # 会话内计分 (U6)
│   │   └── schema/
│   │       ├── SceneConfig.ts       # TypeScript 类型定义 (U3)
│   │       ├── scene-schema.json    # JSON Schema (U3)
│   │       └── ConfigValidator.ts   # Ajv 校验 + 字段级错误 (U3)
│   ├── scenes/
│   │   └── restaurant/
│   │       ├── config.ts            # 餐厅场景声明式配置 (U7)
│   │       └── hooks.ts             # 2-3 个显式 Hook 函数 (U7)
│   └── workers/
│       └── tts-worker.ts            # Kitten TTS Web Worker (U4)
└── tests/
    ├── headless/
    │   ├── config-validation.test.ts  # Schema 校验测试 (U3, R18)
    │   └── dialogue-flow.test.ts      # 对话逻辑无头测试 (U6, R18)
    └── unit/
        ├── ScoreTracker.test.ts
        ├── IntentRouter.test.ts
        └── SessionMachine.test.ts
```

---

## Key Technical Decisions

- **InstancedMesh over merged geometry**：每方块类型一次 draw call，足够 V1 场景；greedy meshing 留到 V2
- **Vite over Webpack**：Kitten TTS 已验证 Vite + ONNX + WASM 兼容性；`assetsInclude` + `worker.format: es` 两行配置解决
- **后端代理 over 直接 API 调用**：GLM-ASR-2512 和 DeepSeek API Key 不暴露在浏览器端；几条 Fastify 路由即可
- **XState v5 over 手写状态机**：7 状态 + 嵌套子状态，手写易出现不可能状态；XState 天然可可视化调试
- **TypeScript types → JSON Schema over 手写 schema**：TypeScript 类型编译为 JSON Schema（`ts-json-schema-generator`），单源真相，类型即是 schema
- **Web Worker + ONNX over 主线程 TTS**：TTS 推理是 CPU 密集型，放主线程会卡 UI 渲染
- **Push-to-Talk (pointerdown/up) over 持续监听**：儿童场景下主动控制更友好，避免误触发和隐私顾虑

---

## Implementation Units

### Phase 1: Foundation

- U1. **项目脚手架 + Vite + TypeScript + Three.js 初始化**

**Goal:** 建立项目骨架，配置构建工具链，安装核心依赖

**Requirements:** R1（Three.js 引入）

**Dependencies:** None

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/index.ts`, `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`

**Approach:**
- Vite + TypeScript strict mode
- Three.js 0.184.0（最新稳定版）
- `vite.config.ts` 配置 `assetsInclude: ['**/*.wasm']`、`worker: { format: 'es' }`、`server.proxy` 指向后端代理
- 后端代理用 Fastify + TypeScript，监听 3001 端口，CORS 允许 localhost
- `index.html` 包含 canvas 占位、麦克风按钮占位、得分面板占位

**Patterns to follow:** Kitten TTS Web Demo 的 Vite 配置（`assetsInclude` + `worker`）

**Test scenarios:**
- Happy path: `npm run dev` 启动，`index.html` 在浏览器中渲染 canvas + 占位 UI
- Integration: `server:dev` 启动后端代理，前端 `/api/asr` 请求通过 Vite proxy 到达后端

**Verification:**
- `npm run dev` 启动后浏览器显示页面
- Three.js 导入可用，基础 scene + camera + renderer 渲染空白场景
- 后端代理启动并响应健康检查

---

- U2. **体素世界渲染器**

**Goal:** 单 chunk 体素世界渲染，支持方块放置、面剔除、自由视角漫游

**Requirements:** R1, R2

**Dependencies:** U1

**Files:**
- Create: `src/engine/renderer/VoxelWorld.ts`
- Create: `src/engine/renderer/ChunkBuilder.ts`
- Create: `src/engine/renderer/BlockTypes.ts`
- Create: `src/engine/renderer/CameraController.ts`

**Approach:**
- `BlockTypes.ts`：定义 V1 方块类型枚举（`FLOOR, WALL, TABLE, CHAIR, COUNTER, AIR`）+ 每类型颜色/纹理
- `ChunkBuilder.ts`：
  - 输入：`{ originX, originY, originZ, width, height, depth, data: Uint8Array }`（V1 单 chunk 原点 (0,0,0)，后续多 chunk 扩展无需改接口）
  - 遍历所有非 AIR 方块，检查 6 个面：邻居为 AIR 则该面可见
  - 按方块类型分组可见位置，为每类型创建共享 `BoxGeometry(1,1,1)` + `InstancedMesh`
  - 为每个可见位置调用 `instancedMesh.setMatrixAt(i, translationMatrix)`
  - NPC 位置标记为 `AIR`（NPC 由独立 Mesh 处理，见 U7）
- `VoxelWorld.ts`：
  - 创建 `THREE.Scene`、`THREE.WebGLRenderer`、定向光 + 环境光
  - 调用 `ChunkBuilder.build(chunkData)` 生成 InstancedMesh 组
  - 暴露 `loadMap(mapData)` 重新构建世界
- `CameraController.ts`：第一人称 WASD + 鼠标旋转，碰撞检测简化为「与 WALL/COUNTER 方块的距离检查」

**Execution note:** 先用手写 6×3×6 小型测试地图验证面剔除和 InstancedMesh 正确性

**Test scenarios:**
- Happy path: 6×3×6 地图全方块 → 仅外表面可见，内部面剔除
- Edge case: 全 AIR 地图 → 场景空但无 crash
- Edge case: 单方块地图 → 6 个面全部渲染

**Verification:**
- 浏览器中看到彩色方块组成的地面 + 墙壁
- WASD + 鼠标可自由移动视角
- 面剔除正确：相邻实心方块之间无面
- DevTools Performance 面板显示稳定 60fps

---

- U3. **场景配置 Schema + 校验器**

**Goal:** TypeScript 类型定义、JSON Schema 生成、Ajv 运行时校验

**Requirements:** R11, R12, R13, R14, R16

**Dependencies:** U1

**Files:**
- Create: `src/engine/schema/SceneConfig.ts`
- Create: `src/engine/schema/scene-schema.json`
- Create: `src/engine/schema/ConfigValidator.ts`
- Create: `tests/headless/config-validation.test.ts`

**Approach:**
- `SceneConfig.ts`：定义完整的场景配置 TypeScript 接口：
  ```typescript
  interface SceneConfig {
    schemaVersion: "1.0";
    name: string;
    description: string;          // 自然语言描述（供 LLM 上下文）
    cefrLevel: "A1" | "A2";
    targetVocabulary: string[];
    map: MapConfig;               // { width, height, depth, layers: BlockLayer[] }
    npcs: NPCConfig[];            // { id, name, role, position, appearance, voice, speechSpeed, interaction, dialogueTree }
    tasks: TaskConfig[];          // { id, description, trigger, targetIntent, scoreReward, maxAttempts }
  }
  ```
  每个字段带 JSDoc `@description`——这些描述同时是 JSON Schema 的 `description`，也是 LLM 生成场景时的 prompt
- 使用 `ts-json-schema-generator` 从 TypeScript 类型编译 `scene-schema.json`
- `ConfigValidator.ts`：`new Ajv().compile(schema)` → `validate(config)` → `{ valid: true } | { valid: false, errors: [{path, message, keyword}] }`
- 字段级错误路径如 `/npcs/0/position`，场景作者可精确定位问题

**Test scenarios:**
- Happy path: 合法餐厅场景配置 → 校验通过
- Error path: NPC 缺少必填字段 `position` → 错误：`/npcs/0 must have required property 'position'`
- Error path: `schemaVersion` 不是 "1.0" → 拒绝
- Error path: `cefrLevel` 为非法值 "C1" → 错误：`must be equal to one of the allowed values`
- Edge case: 空 NPC 列表 → 通过（无 NPC 场景合法）

**Verification:**
- `ConfigValidator.validate(validConfig)` 返回 `{ valid: true }`
- `ConfigValidator.validate(invalidConfig)` 返回具体字段级错误
- 终端运行 `npx vitest run tests/headless/config-validation.test.ts` 全部通过

---

### Phase 2: Voice & Intent

- U4. **TTS 引擎（Kitten TTS WebAssembly）**

**Goal:** 浏览器端离线 TTS——文本 → NPC 语音，Web Worker 中运行 ONNX 推理

**Requirements:** R5

**Dependencies:** U1

**Files:**
- Create: `src/engine/voice/TTSEngine.ts`
- Create: `src/workers/tts-worker.ts`
- Create: `public/tts-model/`（静态资源目录，存放 ONNX 模型文件）

**Approach:**
- **模型来源：** HuggingFace `KittenML/kitten-tts-nano-0.1`，下载 `model_quantized.onnx`、`tokenizer.json`、`voices.json` 放入 `public/tts-model/`
- **Web Worker (`tts-worker.ts`)：**
  - 接收 `{ type: 'init', modelPath: '/tts-model/' }` → 加载 ONNX 模型 + 语音嵌入（`KittenTTS.from_pretrained()`）
  - 尝试 WebGPU 执行提供者，fallback 到 WASM+SIMD
  - `postMessage({ status: 'ready' })` 通知主线程
  - 接收 `{ type: 'generate', text, voice, speed }` → `KittenTTS.stream()` → 合并 chunks → WAV Blob
  - `postMessage({ status: 'complete', audio: blob })`
  - 模型缓存到 IndexedDB，二次加载秒级
- **主线程 (`TTSEngine.ts`)：**
  - 初始化时创建 Worker，等待 `ready` 消息
  - `speak(text, voice, speed): Promise<void>` — 发送 generate → 等待 complete → `AudioContext.decodeAudioData()` → `source.start()`
  - 支持 `interrupt()` 中断当前播放
  - 单例模式——整个引擎只有一个 TTS Worker 实例

**Execution note:** 先不集成到场景，U4 独立验证——输入文本点击播放即可听到语音

**Test scenarios:**
- Happy path: 调用 `tts.speak("Hello!", "expr-f-01", 1.0)` → 浏览器播放语音
- Edge case: 快速连续调用两次 → 第二次等第一次播完再播
- Edge case: 调用 `interrupt()` 中途 → 当前语音停止

**Verification:**
- 独立测试页面：文本输入框 + 播放按钮 → 听到合成语音
- Web Worker 初始化日志正确输出
- 模型从 IndexedDB 二次加载 <1s

---

- U5. **语音交互流水线（Push-to-Talk → ASR → Intent + 后端代理）**

**Goal:** 完整的「按住说话 → 松开发送 → ASR 转写 → 意图路由」流水线 + 后端 API 代理

**Requirements:** R6, R7, R8

**Dependencies:** U1, **Gate: ASR benchmark 通过（需 ≤25% WER 方可解锁 U5-U7）**

**Files:**
- Create: `src/engine/voice/SpeechPipeline.ts`
- Create: `src/engine/voice/IntentRouter.ts`
- Create: `tests/unit/IntentRouter.test.ts`
- Create: `server/src/routes/asr.ts`
- Create: `server/src/routes/intent.ts`

**Approach:**

**后端代理 (`server/`)：**
- `POST /api/asr`：接收 `multipart/form-data`（WAV blob，16kHz mono，浏览器端 Mediabunny 已转换）→ 转发 GLM-ASR-2512 API → 返回 `{ text, duration }`
- `POST /api/intent`：接收 `{ transcript, npcContext, candidateIntents, conversationHistory }` → 转发 DeepSeek V4 Flash → 返回 `{ intentId, confidence }`
- 环境变量注入 API Keys（`.env`），不出现在前端代码中
- CORS 仅允许开发域名

**前端 (`SpeechPipeline.ts`)：**
- `startRecording()`：`navigator.mediaDevices.getUserMedia({ audio: true })` → `MediaRecorder(audio/webm;codecs=opus, 16kbps)` → 开始录音
- `stopRecording(): Promise<Blob | null>`：停止 → 检查时长 < 500ms 则丢弃并提示「再按久一点，说完再松手」，否则收集 WebM chunks → 浏览器端用 Mediabunny 转为 WAV（16kHz mono）→ 返回 WAV Blob
- `transcribe(audioBlob): Promise<string>`：POST `/api/asr` → ASR 文本
- 暴露 `onStateChange(state)` 事件：`idle → listening → transcribing → routing → idle`

**意图路由 (`IntentRouter.ts`)：**
- `route(transcript, npcContext, candidates, history): Promise<{intentId, confidence}>`
- 构建 prompt → DeepSeek V4 Flash（`temperature: 0.1`, `response_format: json_object`）
- 返回 `none` 时触发重试逻辑（最多 3 次）：
  1. 返回 `none` → 调用 DeepSeek 生成 NPC 引导提问 → TTS 播放 → 等待下次录音
  2. 3 次失败 → NPC 示范正确回答并降级通过
- LLM 不可用时降级到本地关键词匹配

**Test scenarios:**
- Happy path: 录音 >500ms → `/api/asr` 返回文本 → `/api/intent` 返回匹配意图
- Edge case: 录音 <500ms → 丢弃，UI 提示「再按久一点」
- Error path: GLM-ASR-2512 请求失败 → `SpeechPipeline` 返回错误状态
- Error path: DeepSeek 返回 `none` → 生成引导提问 → 重试
- Error path: 3 次重试耗尽 → 降级通过，得分减半（0.5×），confidence=0
- Edge case: 无麦克风权限 → 明确错误提示
- Edge case: 空 ASR 返回 → IntentRouter 收到空字符串，直接触发重试引导提问

**Verification:**
- 浏览器点击录音按钮 → 说话 → 松开 → 控制台打印 ASR 文本 + 匹配意图
- 后端代理日志显示 GLM-ASR-2512 和 DeepSeek 调用
- 网络断开时 → 降级到关键词匹配或返回错误

---

### Phase 3: Engine Core & Integration

- U6. **会话生命周期 + 计分系统**

**Goal:** XState v5 会话状态机 + session-scoped 计分

**Requirements:** R3, R4, R9, R10

**Dependencies:** U1

**Files:**
- Create: `src/engine/runtime/SessionMachine.ts`
- Create: `src/engine/scoring/ScoreTracker.ts`
- Create: `tests/unit/SessionMachine.test.ts`
- Create: `tests/unit/ScoreTracker.test.ts`
- Create: `tests/headless/dialogue-flow.test.ts`

**Approach:**
- **`SessionMachine.ts`（XState v5）：**
  - 状态：`idle → loading → active → taskInProgress.dialogue → taskInProgress.scoring → taskComplete → sessionEnd`
  - Context：`{ sceneId, score, completedTasks[], activeTaskId, dialogueRetries, conversationHistory[], sceneFlags: Record<string, unknown> }`
  - 事件：`LOAD_SCENE`, `ACTIVATE`, `TASK_TRIGGERED`, `INTENT_MATCHED`, `INTENT_NONE`, `INTENT_RETRY_EXHAUSTED`, `TASK_COMPLETE`, `END_SESSION`
  - TTS 播放、ASR 录音等异步操作通过 `invoke` + `fromPromise` 表达
- **Hook 机制（R15）：** Scene 配置中定义 `hooks: { onBeforeDialogue?, onIntentMatched?, onTaskComplete? }` 对象——直接函数回调，返回 boolean 控制流程。V1 不引入 EventBus / pub-sub，等 3+ 场景验证后再提取通用事件模式
- **`ScoreTracker.ts`：**
  - `recordAttempt(taskId)` — 记录尝试
  - `completeTask(taskId, confidence, degraded, transcript, targetVocabulary)` — 计算得分（基础分 × 置信度，降级时为 0.5×；LLM 检查 transcript 是否 contain targetVocabulary 中的目标词，覆盖度不足时扣权重）
  - `getSessionScore(): { total, tasks: TaskScore[] }` — 返回会话汇总
  - 纯 session 内状态，不持久化

**Test scenarios:**
- Happy path: `LOAD_SCENE → loading → active → TASK_TRIGGERED → taskInProgress.dialogue → INTENT_MATCHED → scoring → taskComplete → END_SESSION → sessionEnd`
- Happy path: 完成任务 → 得分增加基础分 × 置信度（如 0.95 × 10 = 9.5，取整 10）
- Error path: `INTENT_NONE` × 3 → `INTENT_RETRY_EXHAUSTED` → 降级完成，得分 0.5×
- Edge case: 跨场景切换：餐厅 task-complete → LOAD_SCENE 诊所 → ScoreTracker 保留餐厅得分，追加诊所任务
- Edge case: sessionEnd 后 LOAD_SCENE → 新会话开始，得分重置
- Edge case: 同一任务被触发两次 → 第二次忽略

**Verification:**
- `npx vitest run tests/unit/SessionMachine.test.ts` → 状态转换全部正确
- `npx vitest run tests/unit/ScoreTracker.test.ts` → 得分计算正确
- `npx vitest run tests/headless/dialogue-flow.test.ts` → 完整对话流程可无头测试

---

- U7. **引擎集成 + V1 餐厅场景**

**Goal:** 串联全部模块，实现 V1 餐厅场景，暴露 Scene API

**Requirements:** R1, R2, R3, R5, R6, R7, R9, R13, R14, R15, R17, R19

**Dependencies:** U2, U3, U4, U5, U6

**Files:**
- Create: `src/scenes/restaurant/config.ts`
- Create: `src/scenes/restaurant/hooks.ts`
- Create: `src/engine/runtime/SceneLoader.ts`
- Create: `src/engine/voice/MicButton.ts`
- Modify: `src/index.ts`

**Approach:**

**餐厅场景 (`restaurant/config.ts`)：**
- 地图：32×5×32（5 层高足够室内），地面层 FLOOR，墙壁 WALL 围出 10×8 餐厅区域，内部 TABLE×4、CHAIR×8、COUNTER（吧台）×1
- NPC：`waiter`，坐标 (5, 0, 4)，外观 `waiter_male_01`，语音 `expr-m-01`，语速 0.85，proximity 2 格触发
- 对话树：
  ```
  root: "Welcome! What would you like to order?"
    hintExamples: ["I'd like a hamburger", "Can I have pizza?", "A salad please"]
    candidates:
      - description: "孩子点了某样食物或饮料" → next: confirm_order
  confirm_order: "Great choice! Coming right up. That'll be {score} points!"
    isTerminal: true
  ```
- 任务：`order_food`，触发条件 `dialogue_node: root`，目标意图 `order_food`，完成奖励 10 分，最多 3 次尝试

**餐厅场景 Hook (`restaurant/hooks.ts`)：**
- `onBeforeDialogue(npcId, nodeId, ctx)`：演示非线性 Hook——如果 `npcId === 'waiter'` 且 `nodeId === 'root'` 且标志位 `hasListenedToCustomers` 未置位时返回 false（阻止直接点餐，需先听两个 NPC 顾客对话——V1 演示用途，实际可简化为直接触发）

**SceneLoader.ts：**
- `loadScene(config: SceneConfig)`：校验 → 构建体素世界 → 放置 NPC
- **V1 NPC 渲染占位：** NPC 用彩色 `BoxGeometry(0.6, 1.8, 0.6)` + 顶部 `CSS2DRenderer` 名字标签渲染。`appearance` 字段映射到颜色（`waiter_male_01` → 白色上衣/黑色裤子），后续 V2 替换为角色模型
- `activateScene(sceneId)`：切换活跃场景，保留计分上下文
- `getActiveScene()`：返回当前场景引用

**MicButton.ts（R19）：**
- `<button>` 元素绑定 `pointerdown`/`pointerup` 事件
- 旁显示 hintExamples 气泡，从当前对话节点配置读取
- 录音中显示动画指示器
- 处理中显示 spinner

**引擎入口 (`src/index.ts`)：**
- 暴露 `SceneEngine` 类：`register(sceneConfig)`, `activate(sceneId)`, `getActiveScene()`
- `index.html` 调用：`new SceneEngine().register(restaurantConfig).activate('restaurant')`

**Test scenarios:**
- Happy path (Covers AE1): 儿童靠近服务员 → NPC 说 "Welcome! What would you like to order?" → 提示气泡显示例句 → 儿童按麦克风说 "I'd like a hamburger" → 松开 → ASR 转写 → Intent 匹配 order_food → NPC 说 "Great choice!" → +10 分显示在 UI
- Edge case: 儿童说 "I want to go home" → Intent 返回 none → NPC 引导 "Sorry, I didn't quite catch that — what would you like to eat?"
- Edge case: 3 次都说不相关 → NPC 示范 "You can say 'I'd like a hamburger'" → 降级通过但得分减半
- Happy path (Covers AE2): 加载非法 config → 引擎拒绝，打印字段级错误

**Verification:**
- 浏览器打开 → 看到餐厅 3D 场景，可自由走动
- 走近服务员 → NPC 开口说话 → 麦克风按钮亮起 → 例句气泡显示
- 按麦克风说话 → 松开 → 等待 ~1.5s → NPC 回应
- 完成点餐 → 右上角显示 "+10 points"
- 手动改成非法 config → `register()` 抛出校验错误

---

## System-Wide Impact

- **Interaction graph:** SessionMachine ↔ SpeechPipeline ↔ IntentRouter ↔ TTSEngine → VoxelWorld（渲染），VoxelWorld 被动响应 Runtime 驱动
- **Error propagation:** 语音流水线错误（ASR/LLM 不可用）→ IntentRouter 降级 → SessionMachine 收到降级结果 → ScoreTracker 相应计分
- **State lifecycle risks:** Push-to-Talk 按钮在 `transcribing`/`routing` 状态时需 disable，避免并发语音请求
- **API surface parity:** Scene API（`register/activate/getActiveScene`）是引擎唯一对外契约，内部模块变更不影响外部
- **Integration coverage:** ASR → intent routing → TTS 端到端集成测试需要 mock 后端代理（或测试环境 API Key）
- **Unchanged invariants:** 引擎不持有 DOM——所有 UI 创建由 `index.html` 和 MicButton 模块负责；引擎不处理 URL 路由；引擎不做身份认证

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| GLM-ASR-2512 对 6-12 岁中国儿童英语 WER 不可接受 | V1 前做 benchmark：收集 50+ 条目标年龄段音频样本，WER > 25% 则更换方案 |
| Kitten TTS ONNX 模型首次加载 5s+ 阻塞 | 初始化时异步加载 + loading indicator；IndexedDB 缓存二次加载 <1s |
| DeepSeek V4 Flash 75% 折扣于 2026/05/05 到期 | 规划假设折扣期内完成 V1；到期后每次调用成本约 $0.0012，1000 session/天约 $12 |
| 浏览器不支持 WebAssembly SIMD（低端 Chromebook） | Chrome/Edge 桌面均支持；移动端适配预留降级路径 |
| XState v5 API 不稳定（2026 年仍在演进） | 锁定版本，仅使用 stable 功能 |

---

## Documentation / Operational Notes

- `README.md`：项目概述、架构图、开发环境搭建、环境变量配置
- `ARCHITECTURE.md`：引擎架构详解（组件关系图、数据流、关键决策记录）
- 后端代理环境变量：`GLM_API_KEY`、`DEEPSEEK_API_KEY`，通过 `.env` 注入

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-26-scene-engine-requirements.md](docs/brainstorms/2026-04-26-scene-engine-requirements.md)
- Kitten TTS Web Demo: https://github.com/clowerweb/kitten-tts-web-demo
- GLM-ASR-2512 API: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr-2512
- DeepSeek API: https://platform.deepseek.com/api-docs
- Three.js InstancedMesh: https://threejs.org/docs/#api/en/objects/InstancedMesh
- XState v5: https://stately.ai/docs/xstate
