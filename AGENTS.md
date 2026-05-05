# HiKid.Fun — Agent Instructions

## Project Overview

Three.js 体素场景引擎，为 6-12 岁儿童提供沉浸式英语口语学习体验。引擎封装渲染、语音管线、意图路由、计分、会话生命周期——场景作者（人或 AI）通过声明式配置定义新场景。

## Technology Stack

| 层 | 方案 |
|---|---|
| 渲染 | Three.js 0.184.0 + InstancedMesh |
| TTS | 服务端 Kitten TTS 代理 + WAV 磁盘缓存 |
| ASR | 浏览器本地 Whisper；可选云端 GLM-ASR（配置 `GLM_API_KEY` 后自动启用） |
| 意图路由 | DeepSeek Chat（后端统一 AI 网关） |
| 状态机 | XState v5 |
| 构建 | Vite + TypeScript strict |
| 后端代理 | Fastify |
| 学习数据 | 浏览器本地 `LearningDataStore`（导出/导入/重置） |

## Project Conventions

### File Structure

```
src/
  engine/          # 引擎核心（不依赖具体场景）
    renderer/      # Three.js 体素渲染
    voice/         # TTS、ASR、意图路由、麦克风 UI
    runtime/       # 会话状态机、场景加载、浏览器学习数据
    scoring/       # 计分追踪
    schema/        # 场景配置类型 + 校验器
  scenes/          # 场景定义（每个场景 = config.ts + hooks.ts）
    restaurant/    # 餐厅
    school/        # 学校
    zoo/           # 动物园
    airport/       # 机场
    hotel/         # 酒店
server/            # 后端 API 代理（TTS、文本 AI、场景元数据、额度）
docs/
  brainstorms/     # 需求文档
  plans/           # 规划文档
  solutions/       # 已解决问题的知识库（YAML frontmatter，按分类组织：integration-issues/、build-errors/ 等），实施新功能或调试时可查阅
tests/
  unit/
  headless/
```

### Naming Conventions

- TypeScript strict mode
- `camelCase` for variables, functions, methods
- `PascalCase` for classes, interfaces, types
- 场景配置字段：`snake_case`（与 JSON/YAML 习惯一致）
- 引擎 API（Scene API）：`camelCase`（JavaScript 惯例）

### Architecture Principles

1. **引擎 = 约束层，不是工具库**——引擎封装渲染、语音、计分、生命周期，场景只声明内容
2. **意图路由走 LLM，不走固定分类器**——意图在配置中以自然语言描述表达，运行时由 LLM 匹配
3. **Hook 不暴露引擎内核**——V1 仅 2-3 个显式函数回调（`onBeforeDialogue` / `onIntentMatched` / `onTaskComplete`）
4. **Push-to-Talk 模式**——不持续监听，儿童按住按钮说话、松开后发送
5. **Schema 校验在加载时**——非法配置在渲染前被拒绝，返回字段级错误含路径
6. **学习数据归属浏览器**——进度、积分、词汇搜集和偏好通过 `LearningDataStore` 存在当前浏览器；首页 `Data` 入口负责导出、导入和重置
7. **无头测试优先**——核心逻辑可脱离 WebGL 运行

## Key Constraints

- **不做游戏引擎**：不支持物理模拟、粒子特效、骨骼动画
- **不做课程管理系统**：不负责课程序列编排
- **不做语音评测平台**：只做用词正确性检查，不做逐音节纠音
- **不做账号/云同步**：同一浏览器是一份学习数据，需要跨设备时使用导出/导入
- **不做多人联机**：当前体验是单人学习
- **桌面优先**：Chrome/Edge 起步，移动端后置

## Development Commands

```bash
npm run dev         # 前端 dev server (:5173)
npm run build       # 生产构建
npm run server:dev  # 后端代理 (:3001)
```

## Environment Variables (server/)

```bash
DEEPSEEK_API_KEY=xxx       # 文本 AI Key，用于意图路由和例句生成
DEEPSEEK_MODEL=deepseek-v4-flash

GLM_API_KEY=xxx            # 可选，智谱 AI Key，配置后 ASR 走云端转发
TTS_PORT=8081              # kitten-tts-server 本地端口
TTS_MODEL_PATH=server/model
TTS_CACHE_DIR=server/data/tts-cache
EXAMPLE_CACHE_DIR=server/data/example-cache

AI_DAILY_LIMIT=5000        # 全站每日文本 AI 请求上限
AI_IP_HOURLY_LIMIT=300     # 单 IP 每小时文本 AI 请求上限
TTS_DAILY_LIMIT=10000      # 全站每日 TTS 生成上限（缓存命中不计入）
TTS_IP_HOURLY_LIMIT=600    # 单 IP 每小时 TTS 生成上限（缓存命中不计入）
ASR_DAILY_LIMIT=5000       # 全站每日 ASR 请求上限（仅云端模式生效）
ASR_IP_HOURLY_LIMIT=300    # 单 IP 每小时 ASR 请求上限（仅云端模式生效）

CORS_ORIGIN=https://learn.example.com
TRUST_PROXY=true           # 仅在可信反向代理后开启
SERVER_BODY_LIMIT=262144
```

## Git Workflow

- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- Feature branches from `master`
- PRs 合并前需 type-check 通过（`npx tsc --noEmit`）
