# Scene Engine 🎮

> Three.js 体素场景引擎 —— 为 6-12 岁儿童打造的沉浸式英语口语学习世界

## 这是什么

一个 Minecraft 风格的 3D 体素世界，孩子们在其中自由探索、与 NPC 对话，在游戏中自然习得英语口语和听力。引擎封装了渲染、语音合成、语音识别、意图理解和智能计分——老师或 AI 只需写完 YAML/JSON 配置文件，就能快速生成新的教学场景。

## 当前状态

**V1 已实现** — 包含一个完整的「餐厅」场景：走进餐厅，服务员 Tom 会上前打招呼，孩子按住麦克风按钮说出想点的食物，引擎理解意图、推进对话、并给出积分反馈。

## 开始使用

```bash
# 1. 安装依赖
npm install
cd server && npm install && cd ..

# 2. 配置 API Keys（后端代理需要）
export GLM_API_KEY="your-glm-key"
export DEEPSEEK_API_KEY="your-deepseek-key"

# 3. 启动后端代理（终端 1）
npm run server:dev

# 4. 启动前端（终端 2）
npm run dev
```

打开 http://localhost:5173 ，点击画面锁定鼠标，WASD 移动，走到服务员面前开始对话！

## 技术架构

```
                    ┌─────────────────┐
                    │  场景配置 (YAML)  │
                    │  教师 / AI 编写   │
                    └────────┬────────┘
                             │ load & validate
                    ┌────────▼────────┐
                    │   场景引擎        │
                    │                  │
                    │  ┌─────────────┐ │         ┌──────────┐
                    │  │ Voxel 渲染器 │◄─────────│ Three.js │
                    │  └─────────────┘ │         └──────────┘
                    │                  │
                    │  ┌─────────────┐ │  WebM   ┌──────────┐
   🎤 按住说话       │  │ 语音流水线    │◄────────│ GLM-ASR  │
──────► 松开发送 ────│──│ ASR→Intent │ │  text   │  (智谱)  │
                    │  │ TTS ◄ NPC  │─┼────────►│          │
                    │  └─────────────┘ │         └──────────┘
                    │                  │
                    │  ┌─────────────┐ │         ┌──────────┐
                    │  │ 意图路由器    │◄────────│ DeepSeek │
                    │  │ (LLM 匹配)   │ │  intent │  V4 Flash│
                    │  └─────────────┘ │         └──────────┘
                    │                  │
                    │  ┌─────────────┐ │
                    │  │ 计分 & 状态机 │ │
                    │  └─────────────┘ │
                    └──────────────────┘
```

## 命令

```bash
npm run dev          # Vite 开发服务器 (:5173)
npm run build        # 生产构建
npm run server:dev   # Fastify 后端代理 (:3001)
```

## 目录结构

```
scene-engine/
├── src/engine/          # 引擎核心
│   ├── renderer/        # Three.js 体素渲染
│   ├── voice/           # TTS、ASR、意图路由、麦克风 UI
│   ├── runtime/         # 会话状态机、场景加载
│   ├── scoring/         # 计分
│   └── schema/          # 场景配置类型 + 校验
├── src/scenes/          # 场景定义
│   └── restaurant/      # V1 餐厅场景
├── server/              # 后端 API 代理 (Fastify)
├── docs/
│   ├── brainstorms/     # 需求文档
│   └── plans/           # 规划文档
└── tests/               # 测试
```

## 添加新场景

创建一个场景配置文件：

```typescript
// src/scenes/clinic/config.ts
import type { SceneConfig } from '../../engine/schema/SceneConfig.js';

export const clinicConfig: SceneConfig = {
  schemaVersion: '1.0',
  name: 'Clinic',
  description: 'Visit the doctor and describe your symptoms.',
  cefrLevel: 'A1',
  targetVocabulary: ['headache', 'fever', 'cough'],
  map: { /* ... */ },
  npcs: [
    {
      id: 'doctor',
      name: 'Dr. Smith',
      role: 'A friendly doctor who asks about your symptoms.',
      position: { x: 4, y: 0, z: 4 },
      appearance: 'doctor_female_01',
      voice: 'expr-f-01',
      speechSpeed: 0.9,
      interaction: { type: 'proximity', radius: 3 },
      dialogueTree: [
        {
          id: 'greeting',
          npcText: "Hello! What seems to be the problem?",
          hintExamples: ['I have a headache', 'I feel sick'],
          candidateIntents: [
            {
              intentId: 'describe_symptom',
              description: 'The child describes a health symptom or how they feel',
              nextNodeId: 'diagnose',
            },
          ],
        },
        // ...
      ],
    },
  ],
  tasks: [
    {
      id: 'describe_symptom',
      description: 'Tell the doctor what is wrong.',
      trigger: { type: 'dialogue_node', npcId: 'doctor', nodeId: 'greeting' },
      targetIntent: 'describe_symptom',
      scoreReward: 10,
    },
  ],
};
```

然后在 `main.ts` 中加载它即可。

## 技术栈

| 层 | 方案 |
|---|---|
| 渲染 | Three.js 0.184.0 + InstancedMesh |
| TTS | Kitten TTS (WebAssembly) / browser SpeechSynthesis fallback |
| ASR | GLM-ASR-2512（智谱 AI） |
| 意图路由 | DeepSeek V4 Flash |
| 状态机 | XState v5 |
| 构建 | Vite + TypeScript |
| 后端 | Fastify |
