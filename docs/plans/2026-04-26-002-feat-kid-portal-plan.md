---
title: feat: Kid portal — scene selection, progress persistence, mascot
type: feat
status: active
date: 2026-04-26
origin: docs/brainstorms/2026-04-26-kid-portal-requirements.md
---

# 儿童入口网站 + SQLite 积分持久化 — V1 规划

## Overview

在现有 3D 场景引擎之上构建一个儿童风格的 2D 入口网站。Duolingo 卡片布局展示可玩场景，吉祥物猫头鹰全程引导，积分通过 SQLite 持久化，CEFR 排序 + 完成解锁驱动游戏化学习旅程。

---

## Problem Frame

V1 只有硬编码餐厅场景 + 浏览器内存积分，关闭就没了。需要一个独立于 3D 引擎的 2D 入口——场景选择、进度追踪、积分持久化、儿童友好的游戏化体验。

---

## Requirements Trace

- R1. Duolingo 风格卡片布局（大圆角、明亮色、大字体）
- R2. 卡片：场景名 + 描述 + 完成 ✓ + 星星数
- R3. 点卡片 → 转场动画 → 3D 场景
- R4. 3D 场景结束 → 存积分 → 回入口刷新
- R5. `GET /api/scenes`：动态读 `src/scenes/` 目录返回场景列表
- R6. CEFR 排序 + 完成前置解锁
- R7. SQLite `progress` 表：`scene_id, completed, score, last_played_at`
- R8. `GET /api/progress`：总积分 + 各场景状态
- R9. `POST /api/progress`：更新积分和完成状态
- R10. 积分更新动画（星星飞入 + 树生长）
- R11. 吉祥物猫头鹰：多状态表情/台词/微动效
- R12. 吉祥物仅在入口网站
- R13. 积分树/塔：每 50 分长一层
- R14. 积分更新播放生长动画
- R15. 后端不可用时降级展示缓存数据

---

## Scope Boundaries

### Deferred for later

- 多用户系统 / 登录
- 家长后台
- 移动端适配
- 国际化
- 场景内容市场

### Outside this product's identity

- 游戏发布平台
- 课程管理系统
- 社交/排行榜

---

## Context & Research

### Relevant Code and Patterns

现有仓库结构：
```
src/engine/    — 引擎核心（渲染、语音、计分、状态机）
src/scenes/    — 场景定义（restaurant/config.ts）
server/        — Fastify 后端代理（ASR、意图路由、TTS）
index.html     — 当前直接进入 3D 场景的入口
```

### Technology Decisions

| 决策 | 方案 | 理由 |
|---|---|---|
| SQLite | `better-sqlite3` | 同步 API 最简单，Fastify 单线程不受影响；无 WASM 开销 |
| 入口页面 | `index.html` 改为入口，`play.html` 为 3D 场景 | 保持根路径为入口，语义清晰 |
| 场景配置读取 | `tsx` 运行时 `import()` 场景 config | 无需编译，开发即生效 |
| 吉祥物 | 纯 CSS 绘图 + CSS 动画 | 零额外依赖，体量可控 |
| 积分树 | CSS transitions + SVG | 无 canvas 复杂度，可序列化 |

### External References

- `better-sqlite3`: https://github.com/WiseLibs/better-sqlite3
- Duolingo UI patterns: cards, progress circles, mascot at top-left

---

## Output Structure

```
scene-engine/
├── index.html                  # [NEW] 入口网站（卡片、吉祥物、积分树）
├── play.html                   # [NEW] 原 index.html → 3D 场景引擎入口
├── src/
│   ├── main.ts                 # 3D 场景引擎入口（路径不变）
│   └── portal/                 # [NEW] 入口网站前端
│       ├── portal.ts           # 入口网站主逻辑
│       ├── owl.css             # 吉祥物猫头鹰 CSS
│       ├── cards.css           # 卡片布局样式
│       ├── tree.css            # 积分树样式
│       └── portal.html         # 入口网站 HTML 片段（被 index.html include）
├── server/
│   ├── src/
│   │   ├── index.ts            # 增加 /api/scenes, /api/progress 路由
│   │   └── routes/
│   │       ├── scenes.ts       # [NEW] GET /api/scenes — 读取场景配置
│   │       ├── progress.ts     # [NEW] GET/POST /api/progress — SQLite CRUD
│   │       └── db.ts           # [NEW] SQLite 初始化 + 查询封装
│   └── data/                   # [NEW] SQLite 数据库文件目录
│       └── .gitkeep
```

---

## Key Technical Decisions

- **入口/引擎分离为两个 HTML 页面**：`index.html` 是入口网站，`play.html` 是 3D 场景。Vite 支持多页面构建（`build.rollupOptions.input`）。`play.html` 通过 URL 参数 `?scene=restaurant` 选择场景。
- **场景列表 API 运行时加载 TypeScript**：服务端用 `tsx` 运行，直接用 `import()` 加载 `src/scenes/<id>/config.ts`。每个 config 导出 `SceneConfig` 对象，服务端提取 `name`、`description`、`cefrLevel` 返回给入口页。不需要额外的场景注册表。
- **单条目进度表**：`progress` 表用 `scene_id` 作主键，单用户 V1 只插不删。`upsert` 语义：`INSERT OR REPLACE`。
- **3D 引擎通过 `window.opener.postMessage` 通知入口页**：场景结束时 `play.html` 发送积分数据 → 入口页接收 → 调 `/api/progress` → 刷新 UI。不依赖 localStorage 轮询。
- **吉祥物用 CSS 而非图片/精灵**：一个 `div` 加 `::before`/`::after` 伪元素画出猫头鹰（圆形身体、三角形耳朵、大眼、小嘴）。CSS `@keyframes` 做眨眼、跳跃、挥手。零 HTTP 请求。

---

## Implementation Units

### Phase 1: 后端基础设施

- U1. **SQLite 数据库 + progress API**

**Goal:** 服务端 SQLite 进度存储，读写 API

**Requirements:** R7, R8, R9

**Dependencies:** None

**Files:**
- Install: `npm install better-sqlite3` (server/)
- Create: `server/src/routes/db.ts`
- Create: `server/src/routes/progress.ts`
- Create: `server/data/.gitkeep`

**Approach:**
- `db.ts`：初始化 `better-sqlite3`，建表：
  ```sql
  CREATE TABLE IF NOT EXISTS progress (
    scene_id TEXT PRIMARY KEY,
    completed INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    last_played_at TEXT
  );
  ```
- `GET /api/progress`：`SELECT * FROM progress` → 返回 `{ scenes: [...], totalScore: sum(score) }`
- `POST /api/progress`：`INSERT OR REPLACE INTO progress (scene_id, completed, score, last_played_at) VALUES (...)` → 返回最新进度汇总
- 数据库文件存 `server/data/progress.db`，`.gitignore` 忽略

**Test scenarios:**
- Happy path: POST `{ sceneId: 'restaurant', score: 10, completed: true }` → GET 返回 `restaurant: completed, score=10, totalScore=10`
- Happy path: 同一场景多次 POST → 分数覆盖（INSERT OR REPLACE），totalScore 正确累加
- Edge case: 空数据库 GET → `{ scenes: [], totalScore: 0 }`

**Verification:**
- `curl -X POST localhost:3001/api/progress -d '{"sceneId":"restaurant","score":10,"completed":true}'` → 200
- `curl localhost:3001/api/progress` → 返回包含 restaurant 条目，totalScore=10

---

- U2. **场景列表 API**

**Goal:** 服务端扫描 `src/scenes/` 目录，返回场景元数据 + 解锁状态

**Requirements:** R5, R6

**Dependencies:** U1

**Files:**
- Create: `server/src/routes/scenes.ts`

**Approach:**
- 启动时用 `fs.readdirSync` 扫描 `src/scenes/`，对每个子目录用 `import()` 加载 `config.ts`
- 提取 `{ id: 目录名, name, description, cefrLevel }`
- 从 `progress` 表读取完成状态，计算解锁：CEFR 排序，第一个总是解锁，后续需要前一个 `completed=true`
- `GET /api/scenes` 返回：
  ```json
  {
    "scenes": [
      { "id": "restaurant", "name": "Restaurant", "description": "...", "cefrLevel": "A1", "unlocked": true, "completed": false, "score": 0 },
      { "id": "clinic", "name": "Clinic", "description": "...", "cefrLevel": "A1", "unlocked": false, "completed": false, "score": 0 }
    ]
  }
  ```

**Test scenarios:**
- Happy path: 没有完成任何场景 → restaurant unlocked, 其余 locked
- Happy path: restaurant completed → clinic unlocked
- Edge case: `src/scenes/` 只有一个场景 → 返回单元素数组

**Verification:**
- `curl localhost:3001/api/scenes` → 返回 JSON 数组，restaurant.unlocked=true

---

### Phase 2: 入口网站前端

- U3. **入口页面骨架 + 卡片布局**

**Goal:** 2D 入口网站——场景卡片网格、明亮儿童配色、转场动画

**Requirements:** R1, R2, R3

**Dependencies:** U1, U2

**Files:**
- Create: `index.html`（重写为入口网站）
- Create: `play.html`（原 index.html → 3D 引擎，加 `?scene=` 参数支持）
- Create: `src/portal/portal.ts`
- Create: `src/portal/cards.css`
- Modify: `vite.config.ts`（多页面构建）

**Approach:**
- **`index.html`**：入口网站主页面
  - 顶部：积分树/塔（U5 实现，先放占位数字 `⭐ 0`）
  - 左上角：吉祥物猫头鹰（U4 实现，先放占位 div）
  - 中部：场景卡片网格（`display: grid; grid-template-columns: repeat(auto-fill, 280px)`）
  - 底部：简单 footer
- **卡片组件**：每张卡片 `280×200px`，圆角 20px，微阴影，hover 放大 1.05×
  - 已解锁：亮色背景 + 场景名 + 描述 + 分数
  - 已解锁且完成：绿色边框 + ✓ 标记
  - 未解锁：灰色背景 + 🔒 图标 + 低透明度
- **`portal.ts`**：`fetch('/api/scenes')` → 渲染卡片 → 绑定点击事件
  - 点击已解锁卡片 → CSS 转场动画（卡片飞出 + 页面 slide）→ `location.href = '/play.html?scene=' + id`
- **`play.html`**：完全复制原 `index.html` 的结构，`src/main.ts` 逻辑不变，只是路径从 `?scene=` URL 参数读取场景 ID 而非硬编码 restaurant
- **`vite.config.ts`**：多页面输入
  ```typescript
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
      }
    }
  }
  ```

**Test scenarios:**
- Happy path: 加载 `index.html` → fetch scenes → 渲染 N 张卡片，第一个亮色，其余灰色
- Happy path: 点击已解锁卡片 → 过渡动画 → 跳转 `/play.html?scene=restaurant`
- Edge case: `/api/scenes` 失败 → 卡片区域显示「Loading...」（R15 降级）

**Verification:**
- `npm run dev` → 打开 `localhost:5173` → 看到卡片网格
- 点击 restaurant 卡片 → 进入 3D 场景

---

- U4. **吉祥物猫头鹰**

**Goal:** 纯 CSS 猫头鹰 + 多状态表情 + 台词气泡 + 微动效

**Requirements:** R11, R12

**Dependencies:** U3

**Files:**
- Create: `src/portal/owl.css`
- Create: `src/portal/owl.ts`

**Approach:**
- **CSS 绘图**：一个 `div.owl`，伪元素画出身体（椭圆）、耳朵（三角）、眼睛（大圆 + 瞳孔）、嘴巴（小三角）、翅膀（椭圆旋转）
- **动画**：`@keyframes owl-blink`（眨眼，每 4 秒一次）、`owl-wave`（挥手，页面加载时播放）、`owl-jump`（跳跃，解锁新场景时播放）
- **状态映射**（`owl.ts` 根据积分和进度切换 class）：
  - 默认：`owl-idle`（眨眼 + 微动）
  - 解锁新场景：`owl-jump` + 台词气泡「You unlocked X!」
  - 连续 3 天：`owl-happy` + 🔥 火焰特效
  - 全完成：`owl-celebrate` + 🌟 星星粒子
  - 积分破百：`owl-proud`（翅膀展开）
- **台词气泡**：猫头鹰旁边的一个圆角 `div`，通过 CSS `::after` 画小三角指向猫头鹰。`owl.ts` 根据状态更新文本

**Test scenarios:**
- Happy path: 页面加载 → 猫头鹰出现 → 4 秒后眨眼
- Edge case: 缩小窗口 → 猫头鹰不溢出，保持左上角固定

**Verification:**
- 加载入口网站 → 左上角看到猫头鹰 → 每 4 秒眨眼一次

---

- U5. **积分树/塔**

**Goal:** 页面顶部积分可视化——每 50 分长一层，积分更新时播放生长动画

**Requirements:** R10, R13, R14

**Dependencies:** U3, U1

**Files:**
- Create: `src/portal/tree.css`
- Create: `src/portal/tree.ts`

**Approach:**
- **SVG 塔/树**：一个 `svg` 元素，垂直排列多个 `rect`（方块）组成塔身。
  - 底部：地基方块（总是显示）
  - 每层：一个彩色方块，`opacity: 0` + `transform: scale(0)` → 积分达标时 `opacity: 1` + `transform: scale(1)`（CSS transition 0.5s ease-out）
  - 顶层：尖顶 / 星星装饰
- **层数计算**：`Math.floor(totalScore / 50)`，最大 10 层（500 分满级）
- **积分飞入动画**：积分数字变化时，`⭐ +N` 粒子从数字位置飞出到塔顶，CSS `@keyframes fly-to-tree`
- **`tree.ts`**：`updateTree(totalScore)` → 计算层数 → 设置 CSS custom properties → 触发生长动画

**Test scenarios:**
- Happy path: 积分从 45 涨到 55 → 塔从 0 层长到 1 层，方块弹出动画
- Happy path: 积分 500 → 塔 10 层全满 → 顶层星星闪烁
- Edge case: 积分 0 → 塔只有地基方块

**Verification:**
- 调用 `updateTree(55)` → 第 1 层方块可见并弹出
- 调用 `updateTree(100)` → 第 2 层接着弹出

---

### Phase 3: 集成

- U6. **3D 场景 ↔ 入口网站联动**

**Goal:** 场景结束时积分持久化 + 返回入口刷新 + URL 参数场景选择

**Requirements:** R3, R4, R9

**Dependencies:** U1, U3, U5

**Files:**
- Modify: `src/main.ts`（读 URL 参数选场景，结束时 POST 积分）
- Modify: `play.html`
- Modify: `index.html`

**Approach:**
- **`play.html`**：`<script type="module" src="/src/main.ts">`，同原 `index.html` 结构
- **`main.ts` 修改**：
  - 从 `new URLSearchParams(location.search).get('scene')` 读场景 ID，默认 `restaurant`
  - 动态 import 对应场景 config：`import(\`../scenes/${sceneId}/config.ts\`)`
  - 会话结束时（TTS 播放完 goodbye、触发 sessionEnd）：`fetch('/api/progress', { method: 'POST', body: JSON.stringify({sceneId, score, completed: true}) })`
  - 完成后显示一个「Back to scenes」按钮（CSS 浮层），点击 → `location.href = '/'`
- **会话结束检测**：在 `sessionEnd` 状态订阅中触发 POST。或更简单——在 `endDialogue` 检测 `isTerminal` 时调 POST，并显示返回按钮。
- **`index.html` 修改**：`portal.ts` 在 `DOMContentLoaded` 时强制重新 fetch `/api/scenes` 和 `/api/progress`（不依赖缓存），确保返回后显示最新数据

**Test scenarios:**
- Happy path (Covers AE2): 入口 → 点餐厅 → 3D 中完成点餐 → 返回按钮 → 点击返回 → 入口显示 restaurant ✓ + 积分增加
- Edge case: `/api/progress` POST 失败 → 3D 场景内显示「积分未保存」提示，但不阻塞返回

**Verification:**
- 完整跑一次：入口 → 餐厅 → 点餐 → 返回 → 积分树更新 + 卡片打勾 + 下一张解锁

---

## System-Wide Impact

- **页面架构变更**：从单页面（`index.html` → 3D）变为双页面（`index.html` 入口 + `play.html` 场景）。Vite 需多页面配置。
- **3D 引擎零改动**：`src/engine/` 和 `src/scenes/` 逻辑不变，仅在 `src/main.ts` 的启动和结束处增加 URL 参数读取和 API POST。
- **后端扩展**：Fastify 服务器增加 3 个路由（scenes, progress GET, progress POST）和 SQLite 依赖。
- **跨页面通信**：场景结束时用 `location.href` 跳转回入口页（简单可靠，无需 postMessage）。

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| `tsx` 运行时 `import()` 场景 config 可能有 ESM/CJS 兼容问题 | 提前验证——server 本身就是 tsx + ESM，场景 config 也 export 标准 TS。可行。 |
| `better-sqlite3` 需要原生编译（node-gyp） | macOS arm64 已验证可用；CI/部署时预编译二进制 |
| 多页面 Vite 构建配置复杂 | 仅两个页面，`rollupOptions.input` 两个入口，增量改动 |
| 儿童风格 CSS 资产体量可控 | 纯 CSS 吉祥物 + SVG 塔，零图片，总 CSS < 800 行 |

---

## Documentation / Operational Notes

- `README.md` 更新：入口网站 vs 3D 场景的启动说明
- 服务端增加 `server/data/` 目录的数据库备份提示

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-26-kid-portal-requirements.md](docs/brainstorms/2026-04-26-kid-portal-requirements.md)
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
