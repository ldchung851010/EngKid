---
date: 2026-04-26
topic: kid-portal
---

# 儿童风格入口网站 + 场景选择 + 积分持久化 — 需求文档

## Problem Frame

V1 的 3D 场景引擎只能直接进入硬编码的餐厅场景——没有场景选择、没有积分持久化、没有适合儿童的入口体验。需要一个独立于 3D 引擎的 2D 网页入口，以游戏化的方式展示可用场景、追踪学习进度、并在场景间串联儿童的学习旅程。

---

## Actors

- A1. **儿童学习者 (6-12 岁，单用户 V1)**：在入口网站浏览场景卡片，选择后进入对应 3D 场景学习，完成后返回查看更新后的进度和积分。
- A2. **吉祥物（Mascot）**：页面上的引导角色（猫头鹰），根据积分和进度变换表情、台词，提供情感反馈和鼓励。

---

## Key Flows

- F1. **首次访问**
  - **Trigger:** 打开入口网站
  - **Actors:** A1, A2
  - **Steps:**
    1. 页面加载，吉祥物出现并打招呼
    2. 服务端返回场景列表 + 当前进度
    3. 第一张卡片高亮可点击，其余卡片灰锁状态
    4. 吉祥物台词：「Pick a scene to start learning!」
  - **Outcome:** 儿童看到场景卡片，可点击已解锁的场景进入 3D 学习
  - **Covered by:** R1, R2, R5, R6, R8

- F2. **进入场景学习 → 返回**
  - **Trigger:** 点击已解锁场景卡片
  - **Actors:** A1
  - **Steps:**
    1. 页面过渡动画（吉祥物走路）
    2. 跳转到 3D 引擎页面（`/play?scene=restaurant`）
    3. 儿童在 3D 世界中完成对话任务
    4. 任务完成后，积分 → POST `/api/progress` 存到服务端 SQLite
    5. 点击「返回」回到入口网站
    6. 入口网站拉取最新积分和完成状态，刷新卡片
  - **Outcome:** 积分持久化，卡片状态更新（完成打勾 ✓，总积分增加）
  - **Covered by:** R3, R4, R7, R9

- F3. **解锁新场景**
  - **Trigger:** 完成当前场景的全部任务
  - **Actors:** A1, A2
  - **Steps:**
    1. 服务端标记场景为已完成
    2. 入口网站检测到完成状态 → 下一张卡片解锁动画
    3. 吉祥物祝贺：「You finished the Restaurant! The Clinic is now open!'
  - **Outcome:** 下一张卡片从灰锁变为可点击
  - **Covered by:** R5, R6, R8

---

## Requirements

### 入口网站（2D 网页）

- R1. 入口网站为纯 2D HTML 页面，Duolingo 风格的场景卡片布局——大圆角卡片、明亮配色、大字体、儿童友好的视觉风格。
- R2. 每张卡片显示：场景名称、场景描述（一句话）、是否已完成（✓ 打勾标记）、累计在该场景获得的星星数。
- R3. 点击已解锁的卡片 → 页面转场动画 → 进入对应 3D 场景。
- R4. 3D 场景结束后 → 积分通过 API 存储到服务端 → 返回入口网站 → 卡片状态和积分自动刷新。

### 场景列表 API

- R5. `GET /api/scenes`：读取 `src/scenes/` 目录下的场景配置，返回场景列表。每个场景包含：id、name、description、cefrLevel、是否已解锁（依赖前置场景完成状态）。
- R6. 场景按 CEFR 级别排序（A1 → A2），未解锁的卡片呈灰色 + 锁图标。完成前置场景自动解锁下一个。

### 积分与进度持久化

- R7. 服务端使用 SQLite 存储单用户进度：`progress` 表包含 `scene_id`、`completed`（bool）、`score`（int）、`last_played_at`（timestamp）。
- R8. `GET /api/progress`：返回总积分、各场景完成状态和积分。「积分树/塔」组件据此渲染可视化等级。
- R9. `POST /api/progress`：接收 `{ sceneId, score, completed }`，更新 SQLite，返回最新总积分和进度。3D 引擎在会话结束时调用此接口。
- R10. 积分增长触发前端动画——星星飞入卡片、积分树/塔向上生长。

### 吉祥物

- R11. 页面固定位置（左上角）有一个吉祥物角色（猫头鹰），不同场景下切换表情、台词、微动效：
  - 首页：挥手 + 「Welcome back! You earned X stars today」
  - 连玩 3 天：添加 🔥 连续天数标识
  - 解锁新场景时：跳跃 + 祝贺台词
  - 页面加载/过渡时：走路或飞行动画
  - 完成度 > 50%：「You're halfway there! Keep going!」
  - 完成度 100%：「Amazing! You completed everything! 🌟」
- R12. 吉祥物不进入 3D 场景——仅在入口网站存在。

### 积分可视化

- R13. 页面顶部显示一棵小树/一座塔，积分越高树/塔越高，每个里程碑（50 分）长一层。比纯数字更有粘性。
- R14. 每次积分更新时播放生长动画——新的一层从小变大/弹出。

### 网络与离线

- R15. 后端不可用时入口网站降级展示——显示上次缓存的积分和进度，卡片锁定逻辑按缓存判断。不阻塞 3D 场景的独立运行（3D 场景可在无后端时以本地计分模式运行）。

---

## Acceptance Examples

- AE1. **Covers R1, R2, R5, R6.** 打开入口网站：顶部积分树 0 层（星星 0），下方排列 4 张卡片——餐厅（已解锁，可点击）、诊所（灰锁）、超市（灰锁）、街道（灰锁）。吉祥物在左上角挥手：「Pick a scene to start!」。
- AE2. **Covers F2, R3, R4, R7, R9.** 点击餐厅卡片 → 转场动画 → 进入 3D 餐厅 → 完成点餐任务得 10 分 → 返回入口 → 餐厅卡片显示 ✓ + 10⭐ → 积分树长到第 1 层 → 诊所卡片解锁 → 吉祥物跳跃：「You finished the Restaurant! The Clinic is now open!」
- AE3. **Covers R10, R13, R14.** 积分从 45 涨到 55 → 积分树从第 0 层长到第 1 层（带动画），星星粒子飞入。
- AE4. **Covers R8.** 服务端 SQLite 中 `progress` 表记录：`restaurant: completed=true, score=22, last_played=2026-04-26T...`。

---

## Success Criteria

- 一个 8 岁儿童从打开入口网站到完成一个场景、返回看到积分更新，全程无需家长帮助。
- 卡片布局和色彩搭配在 5 秒内传达「这是一个给小朋友玩的游戏化学习网站」的视觉信号。
- 积分持久化——关闭浏览器后重新打开，积分和完成状态不变。
- 吉祥物让儿童在阅读台词时自发微笑或点头。

---

## Scope Boundaries

### Deferred for later

- 多用户系统（登录 / 选名字 / 切换孩子）
- 家长后台（查看学习报告、设置每日目标）
- 移动端适配（入口网站最初为桌面设计）
- 国际化多语言
- 场景内容市场（社区分享/导入自定义场景）

### Outside this product's identity

- **游戏发布平台**：入口网站不负责场景分发、版本管理、付费订阅
- **课程管理系统**：不做学习路径编排（CEFR 排序 + 前后解锁是最小集合）；不做 AI 学习建议
- **社交/排行榜**：不包含好友系统、全球排名、多人竞技

---

## Key Decisions

- **入口 3 件套同时推进**：卡片 UI + 吉祥物 + 积分树一起做，因为它们是同一个页面的三个不可分割的视觉层。分开做会导致返工对齐。
- **SQLite 单表起步**：`progress` 一张表足够 V1。多用户、多设备同步是 V2 的事。
- **场景列表从配置目录动态读取**：后端扫描 `src/scenes/` 目录读取各场景的 `config.ts` 导出，省去维护独立的场景注册表。解锁顺序隐含在 CEFR 排序中。
- **积分树/塔而非纯数字**：数字太冷感，可视化增长让儿童有「建设」的成就感。资产成本极低（CSS/SVG 即可实现，不需要额外的精灵图）。

---

## Dependencies / Assumptions

- **依赖：SQLite（better-sqlite3 或 sql.js）。** 服务端需要轻量持久化存储，不引入 MySQL/PostgreSQL 的运维负担。
- **依赖：现有 `src/scenes/` 目录结构。** 假设每个场景目录下有 `config.ts` 导出 `SceneConfig` 对象，入口网站后端可动态读取。
- **假设：单用户 V1。** 不需要身份认证。
- **假设：桌面浏览器为主。** 入口网站最初为桌面设计，移动端布局推迟。
- **假设：吉祥物为 CSS/SVG 静态角色 + 简单 CSS 动画。** 不引入 Lottie 或骨骼动画。

---

## Outstanding Questions

### Resolved During Planning

- 单孩子模式（无登录）
- 场景列表由服务端动态提供
- 3D 结束 → 存积分 → 回入口刷新
- 吉祥物、积分树、卡片解锁同时推进

### Deferred to Planning

- [Affects R5][Technical] 后端如何读取 `src/scenes/` 下的 TypeScript 配置（需编译或用 tsx 运行时加载）
- [Affects R7][Technical] SQLite 方案选型：`better-sqlite3`（同步，npm）vs `sql.js`（WASM，无原生依赖）
- [Affects R11][Technical] 吉祥物资产形式：CSS 绘图 vs SVG vs 动画精灵图
- [Affects R13][Technical] 积分树/塔的前端实现技术选型

---

## Next Steps

→ `ce-plan` 进行结构化实现规划。
