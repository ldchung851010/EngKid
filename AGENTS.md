# Scene Engine — Agent Instructions

## Project Overview

Three.js 体素场景引擎，为 6-12 岁儿童提供沉浸式英语口语学习体验。引擎封装渲染、语音管线、意图路由、计分、会话生命周期——场景作者（人或 AI）通过声明式配置定义新场景。

## Technology Stack

| 层 | 方案 |
|---|---|
| 渲染 | Three.js 0.184.0 + InstancedMesh |
| TTS | Kitten TTS WebAssembly / browser SpeechSynthesis fallback |
| ASR | GLM-ASR-2512（智谱 AI，后端代理） |
| 意图路由 | DeepSeek V4 Flash（后端代理） |
| 状态机 | XState v5 |
| 构建 | Vite + TypeScript strict |
| 后端代理 | Fastify |

## Project Conventions

### File Structure

```
src/
  engine/          # 引擎核心（不依赖具体场景）
    renderer/      # Three.js 体素渲染
    voice/         # TTS、ASR、意图路由、麦克风 UI
    runtime/       # 会话状态机、场景加载
    scoring/       # 计分追踪
    schema/        # 场景配置类型 + 校验器
  scenes/          # 场景定义（每个场景 = config.ts + hooks.ts）
    restaurant/    # V1 餐厅
server/            # 后端 API 代理（API Key 保护）
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
6. **Session-scoped 计分**——引擎不负责跨会话持久化，那是上层应用的事
7. **无头测试优先**——核心逻辑可脱离 WebGL 运行

## Key Constraints

- **不做游戏引擎**：不支持物理模拟、粒子特效、骨骼动画
- **不做课程管理系统**：不负责课程序列编排
- **不做语音评测平台**：只做用词正确性检查，不做逐音节纠音
- **不做多人联机**：V1 纯单机
- **桌面优先**：Chrome/Edge 起步，移动端后置

## Development Commands

```bash
npm run dev         # 前端 dev server (:5173)
npm run build       # 生产构建
npm run server:dev  # 后端代理 (:3001)
```

## Environment Variables (server/)

```bash
GLM_API_KEY=xxx         # 智谱 AI API Key
DEEPSEEK_API_KEY=xxx    # DeepSeek API Key
```

## Git Workflow

- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- Feature branches from `master`
- PRs 合并前需 type-check 通过（`npx tsc --noEmit`）
