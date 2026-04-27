---
title: "feat: 新增场景搜集图鉴系统，实现游戏化词汇习得"
type: feat
status: completed
date: 2026-04-27
origin: docs/brainstorms/2026-04-27-collectible-compendium-requirements.md
---

# 搜集图鉴系统 — 实现计划

## 概述

为场景引擎增加游戏化词汇搜集系统。每个场景的 `targetVocabulary` 词汇自动变为可搜集的小物件，散布在 3D 世界中。儿童探索时走近物件会发光，按 E 键触发学习时刻——物件 SVG 放大浮现，TTS 立即朗读单词发音，儿童可反复重听，确认后播放庆祝动画+音效并持久化到 SQLite。Portal 页面新增图鉴浮层，按场景分组展示全部搜集进度，支持 TTS 回放和 LLM 生成例句。

本系统与现有 NPC 对话/任务系统**完全平行**运行，不相互依赖。场景作者只需定义 `targetVocabulary`，零额外配置即可启用搜集功能。场景也可通过新增的 `collectibles` 字段覆盖位置、SVG 或补充词汇。

---

## 问题框架

当前词汇习得仅发生在 NPC 对话任务中。儿童完成对话后缺乏继续探索的动力。搜集系统给他们一个在场景里四处走动的理由——在主动探索中接触更多英语单词。核心设计原则：**学单词是第一位的，搜集只是书签**。

---

## 需求追溯

### 场景内搜集交互

- R1. 引擎根据场景 `targetVocabulary` 自动生成可搜集物件，渲染为 3D 标记物放置在场景地面
- R2. 儿童进入 ~2 米范围时物件发光 + 显示「E」交互提示
- R3. 按 E 键触发发现时刻：物件 SVG 放大浮现到屏幕中央，引擎立即 TTS 朗读单词发音
- R3a. 已搜集过的物件不再出现（跨会话持久化）
- R3b. 搜集物默认无文字提示——发光是唯一的发现线索
- R3c. 喇叭按钮（🔊）可无限次重听发音
- R3d.「Got it! ✓」确认按钮——确认搜集，播放庆祝动画+音效，持久化到 DB，物件消失

### 跨会话持久化

- R4. 搜集记录持久化到 SQLite `collectibles` 表：`word`、`scene_id`、`collected_at`
- R4a. 场景加载时查询已搜集列表，隐藏已搜集的物件
- R4b. 确认时即时写入（非会话结束批量写入）

### 图鉴 UI

- R5. Portal 页面星星计数旁新增图鉴图标（📖），显示已搜集总数
- R6. Portal 加载时从 API 获取搜集统计数据
- R7. 图鉴浮层：全屏、按场景分组、已搜集（彩色 SVG + 单词）和未搜集（灰色剪影 + 问号）
- R7a. 点击遮罩、关闭按钮或 Escape 键关闭
- R7b. 浮层打开时焦点锁定在浮层内
- R8. 点击浮层中已搜集物件 → TTS 朗读单词
- R9. LLM 生成适合 6-12 岁儿童的简单英文例句和中文解释；TTS 朗读例句；文字气泡展示
- R9a. 模块级缓存：同一 Portal 页面访问内不重复请求 LLM

**来源角色:** A1（儿童学习者 6-12 岁）、A2（引擎/系统）、A3（场景作者/人或 AI）
**来源流程:** F1（发现并学习词汇）、F2（查看图鉴）、F3（图鉴中学习单词）
**来源验收示例:** AE1（餐厅搜集流程完整交互）、AE2（Portal 图鉴图标 + 浮层）、AE3（图鉴 TTS + LLM 例句）

---

## 范围边界

- 不做稀有度分级（延后）
- 不做搜集进度奖励（延后）
- V1 不做随机动态放置算法（使用简单固定规则）
- 不做不同稀有度/场景的差异化音效（延后）
- 不做图鉴搜索/筛选（延后）
- 不做成就徽章系统（超出产品定位）
- 不做社交分享/排行榜（超出产品定位）
- 不做 NFT/区块链（超出产品定位）

### 延后到后续工作

- 移动端触控交互（点击/长按替代 E 键）——等移动端适配阶段再处理

---

## 上下文与研究

### 相关代码与模式

| 模式 | 来源 | 复用方式 |
|---|---|---|
| 距离检测 | `src/main.ts:checkNPCProximity()` — 每 500ms 检测 xz 平面距离 | 新增 `checkCollectibleProximity()` 在同一循环中 |
| 按键输入 | `src/engine/voice/MicButton.ts` — 在 document 上监听 Q 键 | 注册 `KeyE` 监听；E 键当前未被使用 |
| DOM 浮层 | `#loading-overlay`、`#mic-container`、`#score-hud` | 搜集 UI 浮层使用 fixed 定位 DOM div |
| TTS 播放 | `src/engine/voice/TTSEngine.ts` — `speak(text, voice, speed)` | 复用于发现时刻发音 |
| Canvas 精灵 | NPC 状态指示器 — Canvas → CanvasTexture → Sprite | 光晕 + E 提示精灵 |
| 3D 对象构建 | `src/engine/renderer/ScenePrimitives.ts` — `addBox()` | 搜集物 3D 标记主体 |
| 场景配置 Schema | `src/engine/schema/SceneConfig.ts` | 新增可选 `collectibles?: CollectibleOverride[]` |
| 配置校验 | `src/engine/schema/ConfigValidator.ts` | 新增 `validateCollectibles()` |
| SQLite 持久化 | `server/src/routes/db.ts` — `progress` 表 upsert 模式 | 新建 `collectibles` 表 |
| Fastify 路由 | `server/src/routes/progress.ts` — GET/POST 处理 | 新建 `server/src/routes/collectibles.ts` |
| LLM 代理 | `server/src/routes/intent.ts` — DeepSeek API 调用 | 新建 `/api/example` 端点 |
| Portal DOM | `src/portal/portal.ts` — `loadPortal()`、卡片渲染 | 图鉴图标 + 浮层集成 |
| Portal 音频 | `portal.ts:playRandomQuote()` — `new Audio(url)` | Portal TTS：POST /api/tts → blob URL → HTMLAudioElement |
| 场景模块模式 | `src/scenes/restaurant/index.ts` — `SceneModule` 接口 | 新场景自动从 `targetVocabulary` 继承搜集物 |
| 指针锁定 | `src/engine/renderer/CameraController.ts` | 按 E 退出指针锁定；确认后恢复 |

### 过往经验

- **Kitten TTS 集成**（`docs/solutions/integration-issues/kitten-tts-web-worker-integration-2026-04-26.md`）：团队已从浏览器端 ONNX 切换到服务端 kitten-tts-server。TTS 管线稳定——`POST /api/tts` → kitten-tts-server → PCM 转 WAV → 播放。搜集物发音无需新增 TTS 集成工作。

### 外部参考

无——本地代码库模式足以覆盖所有实现需求。

---

## 关键技术决策

- **搜集时退出指针锁定**：按 E 时调用 `document.exitPointerLock()`，然后显示搜集 UI 浮层。确认或关闭后，点击 canvas 重新锁定指针。理由：指针锁定期间鼠标点击会旋转镜头，DOM 按钮无法点击。E 是自然的「互动」键，退出锁定是 Minecraft 风格的容器交互模式。

- **Web Audio API 合成庆祝音效**：使用两个 `OscillatorNode` 合成短促双音「叮咚」，通过 `GainNode` 控制包络。零外部依赖、零素材文件，符合「不引入外部动画/音频库」的约束。`celebration-sound.ts` 中创建独立的 `new AudioContext()`（不依赖 TTSEngine 的私有 context）。

- **搜集物 3D 标记：悬浮卡片 + 精灵光晕**：主体使用 `addBox()` 配合 `MeshStandardMaterial({ emissive })`，包裹在旋转 Group 中。光晕使用独立的 `THREE.Sprite`（Canvas 径向渐变 → CanvasTexture）。不引入后处理 bloom——精灵光晕更简洁，与现有 NPC 状态指示器模式一致。

- **放置策略：最大努力网格填充**：扫描所有可行走地面格子（y=0、block type=FLOOR、上方无墙壁阻挡、距离 NPC 出生点 >2 格），按距地图中心距离排序（螺旋向外）。每个单词从候选列表中取下一个位置。显式 `collectibles[].position` 覆盖优先。如果词汇量超出可行走位置数（极少见的密集词汇地图设计问题），发出 console warning 并跳过多余词汇。

- **Portal TTS 使用 HTMLAudioElement**：使用 `fetch POST /api/tts` → blob → `URL.createObjectURL(blob)` → `new Audio(blobUrl)` 播放单词和例句。理由：Portal 页面没有 `TTSEngine` 实例（需要 AudioContext 初始化 + 15 秒健康检查）。使用已有的 HTMLAudioElement 模式（与 Portal 中 kitten 引用音频播放相同）更简洁，不增加 Portal 加载时间。

- **SVG 回退：首字母圆形**：当词汇在 SVG 映射库中不存在时，渲染一个带首字母的样式圆形。确保无论词汇覆盖范围如何，都不会出现视觉破损状态。

- **LLM 例句生成 Prompt**：新建 `/api/example` 端点。Prompt：`"You are helping a young child (ages 6-12) learn English. For the word '{word}' (CEFR {level}), provide: 1) one very simple English sentence using the word (maximum 8 words, use vocabulary a 6-year-old would know), 2) a short Chinese explanation suitable for a child. Return valid JSON: {sentence: string, explanation: string}."` Temperature 0.3，max_tokens 150，`response_format: json_object`。`portal.ts` 中 module-scoped Map 缓存（页面刷新即清空）。

- **多物件同时触发规则**：范围内最近的物件激活。如果两个物件距离完全相等，取放置列表中第一个（确定性行为）。避免「两个都发光但都不响应按 E」的困惑场景。

- **走开行为**：一旦按 E 进入发现模式，即使超出范围 UI 仍保持显示。30 秒无交互超时自动关闭（不保存）。理由：儿童可能一边走动一边听发音。

- **确认按钮门槛**：确认按钮初始隐藏，首次 TTS 播放完成后才显示。确保儿童至少听到一次发音才能搜集。

---

## 未决问题

### 规划中已解决

- **搜集物 3D 渲染形态**：悬浮旋转卡片（小方块 + emissive 材质）。选择理由：比旋转星星更简洁，与现有方块几何模式一致。
- **光效实现**：精灵径向渐变光晕（Canvas → CanvasTexture → Sprite）。不需要后处理。
- **指针锁定 vs 搜集 UI**：按 E 退出指针锁定，确认/关闭后恢复。见关键技术决策。
- **Portal TTS 方式**：HTMLAudioElement + blob URL。见关键技术决策。
- **庆祝音效来源**：Web Audio API 振荡器合成。见关键技术决策。
- **V1 用户隔离**：无用户系统。所有访问者共享 `collectibles` 表。简单的 localStorage 用户 ID 键作为延后改进；V1 单人场景假设成立。
- **图鉴中未搜集物件**：按场景分组显示灰色剪影 + 问号。激励重新探索，但不暴露具体位置——符合「无文字提示」原则。

### 延后到实现阶段

- [影响 R1] 每个场景的搜集物密度（每平方可行走面积放置几个）
- [影响 R2] 光晕动画参数（脉冲速度、emissive 强度范围）
- [影响 R3] 不同视口尺寸下 SVG 大小和居中定位
- [影响 R3d] 庆祝动画的缓动曲线和持续时间调优
- [影响 R7] 图鉴浮层的具体 CSS 布局和响应式行为
- [影响 R9] LLM prompt 在真实儿童测试后的措辞微调

---

## 高层技术设计

> *以下展示设计意图，为 Review 提供方向性指导，不是实现规范。实现 Agent 应将其作为上下文参考，而非直接复制的代码。*

### 搜集发现流程（F1）

```
儿童走动 → 距离检测（每 500ms）
  └─ 镜头距离未搜集物件 < 2m？
      ├─ 是 → 物件发光 + 显示「E」精灵
      │        儿童按 E？
      │        ├─ 否（走开了） → 隐藏光晕 + E 精灵
      │        └─ 是 → exitPointerLock()
      │                 显示搜集浮层 DOM：
      │                   ┌─────────────────────────┐
      │                   │     [SVG 图标 128px]    │
      │                   │     🔊（重听 TTS）      │
      │                   │   [Got it! ✓] 按钮      │  ← 首次 TTS 完成后才出现
      │                   └─────────────────────────┘
      │                 TTS.speak(word, 'Kiki', 0.75)
      │                 儿童点 🔊？→ 再次 TTS.speak(word)
      │                 儿童点「Got it! ✓」？
      │                 ├─ 是 → 播放庆祝动画（CSS）
      │                 │        播放 SFX（Web Audio 叮咚）
      │                 │        POST /api/collectibles {word, sceneId}
      │                 │        从场景移除物件
      │                 │        隐藏浮层
      │                 │        500ms 冷却后才检测下一个搜集物
      │                 └─ 30s 超时或按 Escape
      │                     → 隐藏浮层，不持久化
      └─ 否 → 无事发生
```

### 图鉴浏览流程（F2）

```
Portal 加载 → GET /api/collectibles
  → [{word, scene_id, collected_at}, ...]
  → 按 scene_id 分组，合并场景列表
  → 在 #star-count 旁渲染 📖 图标 + 总数
  → 点击图标 → 显示 #compendium-overlay：
      ┌──────────────────────────────────────┐
      │  图鉴                            [✕] │
      │                                      │
      │  🍽️ 餐厅  3/7                        │
      │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
      │  │🍔   │ │🍕   │ │🥗   │ │  ?  │   │
      │  │hamb.│ │pizza│ │salad│ │ ??? │   │
      │  └─────┘ └─────┘ └─────┘ └─────┘   │
      │  ┌─────┐ ┌─────┐ ┌─────┐            │
      │  │  ?  │ │  ?  │ │  ?  │            │
      │  │ ??? │ │ ??? │ │ ??? │            │
      │  └─────┘ └─────┘ └─────┘            │
      │                                      │
      │  🏫 学校  1/5                        │
      │  ...                                 │
      └──────────────────────────────────────┘
  → 点击已搜集物件 → TTS 朗读单词
  → POST /api/example {word} → {sentence, explanation}
  → TTS 朗读例句，显示文字气泡
```

### 数据模型

```
SceneConfig（已有，扩展）：
  + collectibles?: CollectibleOverride[]
    { word: string, position?: {x,y,z}, svg?: string }

数据库（新表）：
  CREATE TABLE collectibles (
    word         TEXT NOT NULL,
    scene_id     TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    PRIMARY KEY (word, scene_id)
  )

API（新路由）：
  GET  /api/collectibles           → { items: CollectibleItem[] }
  POST /api/collectibles           → body: { word, sceneId }
  POST /api/example                → body: { word, cefrLevel }
                                     → { sentence, explanation }
```

---

## 实现单元

- U1. **后端基础：数据库 Schema、API 路由、场景配置扩展**

**目标:** 创建其他所有单元依赖的数据层和 API 接口。

**需求:** R4, R4a, R4b, R5（后端部分）

**依赖:** 无

**文件:**
- 修改: `server/src/routes/db.ts` — 新增 `collectibles` 表创建 + `getCollectibles()` / `upsertCollectible()` 函数
- 新建: `server/src/routes/collectibles.ts` — GET `/api/collectibles`、POST `/api/collectibles` 路由
- 修改: `server/src/index.ts` — 注册 `collectiblesRoutes`（prefix `/api`）
- 修改: `src/engine/schema/SceneConfig.ts` — 新增 `CollectibleOverride` 接口、`SceneConfig` 增加可选 `collectibles?: CollectibleOverride[]`
- 修改: `src/engine/schema/ConfigValidator.ts` — 新增 `validateCollectibles()` 校验并在 `validateConfig()` 中调用
- 测试: `tests/headless/collectibles-db.test.ts`
- 测试: `tests/headless/collectibles-config-validation.test.ts`

**方案:**
- DB 表沿用 `progress` 表模式：`CREATE TABLE IF NOT EXISTS`、WAL 模式已启用
- `getCollectibles()` 默认返回全部行；可选按 `scene_id` 过滤
- `upsertCollectible(word, sceneId)` 以当前时间戳 upsert
- `CollectibleOverride` 字段：`word: string`、`position?: {x,y,z}`、`svg?: string`（场景配置字段用 snake_case）
- `ConfigValidator` 校验：`word` 为非空字符串、`position` 如存在则 x/y/z 为数值、同一 `collectibles` 数组内无重复 `word`

**遵循的模式:**
- `server/src/routes/db.ts` — 建表 + upsert 模式
- `server/src/routes/progress.ts` — GET/POST Fastify 路由结构
- `src/engine/schema/SceneConfig.ts` — 接口扩展模式（如 `NPCConfig.interaction` 可选字段）
- `src/engine/schema/ConfigValidator.ts` — `validateNPC()` / `validateTask()` 函数模式

**测试场景:**
- 正常路径: `upsertCollectible('hamburger', 'restaurant')` → 数据库中存在该行；`getCollectibles()` 返回该行
- 正常路径: `getCollectibles('restaurant')` 仅返回餐厅场景的条目
- 正常路径: 同一 word+scene 重复 upsert → 单行，时间戳更新
- 边界情况: 空数据库 `getCollectibles()` → 返回空数组
- 边界情况: `getCollectibles('nonexistent')` → 返回空数组
- 边界情况: `SceneConfig` 含 `collectibles: [{word: 'pizza'}]` → 校验通过
- 错误路径: `collectibles: [{word: ''}]` → 校验错误「空单词」
- 错误路径: `collectibles` 中重复 word → 校验错误「重复单词」
- 错误路径: `POST /api/collectibles` 缺少 `sceneId` → 400 错误

**验证:**
- `npx tsc --noEmit` 通过（新类型无编译错误）
- 无头测试通过（DB 操作和配置校验）
- `GET /api/collectibles` 返回有效 JSON

---

- U2. **SVG 词汇映射库**

**目标:** 创建常用 A1/A2 英语词汇到内联 SVG 图标字符串的映射，含首字母圆形回退。

**需求:** R1, R7, R7a（已搜集/未搜集物件的 SVG 渲染）

**依赖:** 无（但 U4、U6 消费它）

**文件:**
- 新建: `src/engine/collectibles/vocab-svg-map.ts` — `getSvgForWord(word: string): string` 函数
- 测试: `tests/headless/vocab-svg-map.test.ts`

**方案:**
- 从 5 个已有场景配置的 `targetVocabulary` 中提取全部词汇（约 35 个独特单词）作为初始映射
- 每个 SVG 为内联字符串（非外部文件）——内联 SVG 在 DOM（图鉴）和 Canvas（3D 精灵）中均可使用
- 映射为 `Record<string, string>` 显式条目；回退使用首字母渲染：
  ```typescript
  function getSvgForWord(word: string): string {
    return SVG_MAP[word.toLowerCase()] ?? firstLetterSvg(word);
  }
  ```
- `firstLetterSvg(word)` 生成简单圆形 + 首字母大写
- SVG 风格：统一 64×64 viewBox、儿童友好的圆角形状、明亮色彩

**遵循的模式:**
- `src/portal/portal.ts` — 已有 `sceneEmoji` Record 映射模式
- `src/engine/renderer/ScenePrimitives.ts` — Canvas 渲染工具模式

**测试场景:**
- 正常路径: `getSvgForWord('hamburger')` 返回含 `<svg>` 标签的非空字符串
- 正常路径: `getSvgForWord('pizza')` 返回与 hamburger 不同的 SVG
- 边界情况: `getSvgForWord('')` 返回无字母的首字母 SVG
- 边界情况: `getSvgForWord('xylophone')`（不在映射库中）返回首字母「X」的 SVG
- 边界情况: 所有已有场景 `targetVocabulary` 中的词汇均输出有效 SVG

**验证:**
- 测试套件通过（已映射 + 未映射词汇）
- 每个 SVG 输出为有效 XML（测试中可用 DOMParser 解析验证）

---

- U3. **庆祝音效：Web Audio API 合成**

**目标:** 创建短促的儿童友好庆祝音效，仅使用 Web Audio API 振荡器——零外部素材。

**需求:** R3d（庆祝动画音效）

**依赖:** 无（U4 消费它）

**文件:**
- 新建: `src/engine/collectibles/celebration-sound.ts` — `playCollectSound(): void` 函数

**方案:**
- 两个 `OscillatorNode`：先发中频音（523Hz C5），再发高音（784Hz G5）
- `GainNode` 包络：快速起音（0.01s）、短保持（0.1s）、快速衰减（0.2s）
- 时序：播放第一个音 → 0.15s 后播放第二个音
- 创建独立 `new AudioContext()`（不耦合 TTSEngine 的私有实例）。处理挂起状态：播放前调用 `audioContext.resume()`
- 无外部文件、无预加载——即用即弃函数
- 必须处理 AudioContext 挂起（浏览器自动播放策略）：播放前 resume context

**遵循的模式:**
- `src/engine/voice/TTSEngine.ts` — AudioContext 使用模式
- `src/portal/portal.ts` — HTMLAudioElement `play().catch()` 错误处理

**测试场景:**
- 正常路径: `playCollectSound()` 无错误完成（AudioContext 可用）
- 边界情况: AudioContext 挂起状态下 `playCollectSound()` → 自动 resume + 播放
- 边界情况: `playCollectSound()` 无 AudioContext 支持 → catch 并记录 warning，不抛出异常

**验证:**
- Chrome/Edge 中音效正常播放无报错
- 快速连击确认按钮无 console 错误
- `playCollectSound()` 不抛出未处理异常

---

- U4. **场景内搜集系统：放置、渲染、距离检测、交互**

**目标:** 从 `targetVocabulary` + 可选覆盖生成搜集物 3D 标记，处理距离检测（光晕 + E 提示），实现完整发现→确认→搜集流程（含 TTS 和持久化）。

**需求:** R1, R2, R3, R3a, R3b, R3c, R3d, R4, R4a, R4b

**依赖:** U1（Schema、API）、U2（SVG）、U3（音效）

**文件:**
- 新建: `src/engine/collectibles/CollectibleManager.ts` — 位置计算、标记生成、距离检测、交互处理
- 新建: `src/engine/collectibles/collect-overlay.ts` — DOM 浮层（SVG 展示、喇叭按钮、确认按钮）
- 新建: `src/engine/collectibles/index.ts` — barrel 导出
- 修改: `src/main.ts` — 集成 CollectibleManager：场景加载时初始化、渲染循环中运行距离检测、注册 E 键处理
- 测试: `tests/headless/collectible-placement.test.ts`
- 测试: `tests/headless/collectible-proximity.test.ts`

**方案:**
- **放置**: 从 `targetVocabulary` + `collectibles` 覆盖计算位置。默认放置：扫描所有 y=0 层 FLOOR 类型且可行的格子（上方无墙壁阻挡、距离 NPC 出生点 >2 格）。收集合法候选位置，按距地图中心距离排序（螺旋向外，自然散布）。每个单词从排序列表中取一个位置。`collectibles[].position` 显式覆盖优先。保证：每个 `targetVocabulary` 单词都有一个位置（R1 要求）。如果有比合法位置更多的单词（极少见的密集词汇地图设计问题），发出 console warning 并跳过多余词汇。
- **3D 标记**: 每个搜集物创建一个 `THREE.Group`。主体：`addBox()` 配合 `MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0 })`。光晕精灵：Canvas 径向渐变 → `CanvasTexture` → `THREE.Sprite`（`depthTest: false`），初始隐藏。E 提示精灵：Canvas 用「E」文本 → 精灵放在标记上方，初始隐藏。元数据：`group.userData = { collectibleWord, collectibleSceneId, collected: false }`。
- **距离检测**: 在渲染循环的 500ms 定时器中与 `checkNPCProximity()` 并行调用。遍历搜集物 group，计算到镜头的 2D 距离。在范围内（默认 2.0 单位）：设置 `emissiveIntensity` 为 0.6、显示光晕精灵、显示 E 精灵。超出范围：恢复默认状态。已搜集的物件跳过（搜集后从活跃列表中移除）。
- **E 键处理**: 在 document 上注册 `keydown KeyE`。当 E 按下且搜集物在范围内（跟踪为 `activeCollectible`）：调用 `exitPointerLock()`，显示搜集浮层 DOM（SVG 居中 + 喇叭按钮），触发 TTS 发音。「Got it! ✓」确认按钮**初始隐藏**，首次 TTS 播放完成后才出现——确保儿童至少听到一次发音。喇叭按钮始终可见用于重听。浮层回调处理重听（再次 TTS）和确认（庆祝动画、SFX、POST /api/collectibles、移除 3D 标记、隐藏浮层）。POST 失败时在浮层确认按钮下方显示 3 秒简短错误信息——儿童可重试确认。浮层 DOM 为此预留错误文本插槽。
- **TTS**: 使用 `ttsEngine.speak(word, 'Kiki', 0.75)` 获得清晰慢速发音。
- **确认后冷却**: 确认搜集后设置 500ms 冷却，期间不激活其他搜集物。避免连续搜集的机械感。
- **浮层超时**: 30 秒无交互定时器。超时后隐藏浮层，不持久化，下次点击 canvas 恢复指针锁定。
- **退出/重入**: 浮层关闭后（确认、取消或超时），通过下次 canvas 点击恢复指针锁定（现有 CameraController 行为）。

**实现提示:** 放置和距离检测函数优先编写测试（纯逻辑，无 Three.js 依赖）。浮层渲染和 TTS 集成依赖 DOM/API，通过手动验证。

**遵循的模式:**
- `src/main.ts:checkNPCProximity()` → 距离检测循环模式
- `src/main.ts` NPC 生成 → 标记生成 + scene.add 模式
- `src/engine/voice/MicButton.ts` → keydown 处理模式
- `src/engine/voice/TTSEngine.ts` → TTS 调用模式
- `#loading-overlay` DOM → 搜集浮层 DOM 结构模式

**测试场景:**
- 正常路径: `computePlacements(targetVocabulary, mapSize, npcPositions)` 返回 N 个地图范围内的合法位置
- 正常路径: 每个位置在可行走 y 层，不与 NPC 出生点碰撞
- 正常路径: `isInRange(cameraPos, itemPos, 2.0)` 在半径内返回 true、外返回 false
- 正常路径: `getActiveCollectible(items, cameraPos)` 多个在范围内时返回最近的一个
- 边界情况: 空 `targetVocabulary` → 返回空放置列表
- 边界情况: 词汇数超过可行走位置 → 填满可填充的，跳过溢出（log warning）
- 边界情况: 两个物件距离完全相等 → `getActiveCollectible` 返回放置列表中第一个（确定性）
- 边界情况: 已标记 `collected: true` 的物件被过滤跳过
- 集成: E 键仅在 `activeCollectible` 非 null 时触发；其他情况无操作
- 集成: 浮层已显示时 E 键不重复触发（防重复打开）
- 集成: 确认按钮 → POST /api/collectibles 成功 → 物件从活跃列表移除
- 集成: 确认按钮在首次 TTS 完成前不可见（灰色或隐藏）

**验证:**
- 进入餐厅场景 → 看到墙边发光物件 → 走近 → E 提示出现 → 按 E → SVG 出现，TTS 播放「hamburger」→ 确认按钮在 TTS 结束后出现 → 点 🔊 重听 → 点「Got it!」→ 庆祝音效+动画 → 物件消失
- 刷新页面 → 重新进入餐厅 → 上次搜集的物件不再出现
- 按 E 后不确认 → 关闭页面 → 重新进入 → 物件仍可搜集
- 浮层显示时走开 → 浮层保留 → 30s 超时 → 浮层关闭 → 不写 DB
- 连续搜集两件相邻物件 → 第一次确认后 500ms 内不触发第二次

---

- U5. **LLM 例句端点 + 前端集成**

**目标:** 新增服务端点生成适龄例句和中文解释，配合前端缓存。

**需求:** R9, R9a

**依赖:** U1（服务端路由模式、API 注册）

**文件:**
- 新建: `server/src/routes/example.ts` — `POST /api/example` 端点
- 修改: `server/src/index.ts` — 注册 `exampleRoutes`
- 修改: `src/portal/portal.ts` — 内联 `Map<string, {sentence, explanation}>` 缓存 + 图鉴物件点击时调用例句端点
- 测试: 手动验证（缓存行为在 U6 集成验证中覆盖；端点通过 curl/集成测试验证）

**方案:**
- **服务端点**: POST `/api/example` 接受 `{ word: string, cefrLevel?: 'A1' | 'A2' }`。构建面向 6-12 岁中国儿童的 prompt。调用 DeepSeek API（`model: 'deepseek-chat'`、`response_format: 'json_object'`、`temperature: 0.3`、`max_tokens: 150`）。返回 `{ sentence: string, explanation: string }`，失败返回 502。
- **Prompt 模板**: `"You are helping a young child (ages 6-12) learn English. For the word '{word}' (CEFR {level}), provide: 1) one very simple English sentence using the word (maximum 8 words, use vocabulary a 6-year-old would know), 2) a short Chinese explanation suitable for a child. Return valid JSON: {sentence: string, explanation: string}."`
- **降级**: DeepSeek 不可达时返回 502。前端处理：仅显示 TTS 发音，不显示例句。
- **前端缓存**: `portal.ts` 顶层 module-scoped `Map<string, {sentence, explanation}>`。点击单词时先查缓存，命中则跳过 POST。页面刷新时清空（Map 自然生命周期）。缓存键：`word.toLowerCase()`。
- **边界情况**: 同一单词不同 CEFR 级别——缓存键不做区分。V1 可接受；所有词汇为 A1/A2 级别。

**遵循的模式:**
- `server/src/routes/intent.ts` — DeepSeek API 调用模式（fetch、auth header、JSON 解析、错误处理）
- `server/src/index.ts` — 路由注册模式（`app.register(exampleRoutes, { prefix: '/api' })`）

**测试场景:**
- 正常路径: `POST /api/example {word: 'hamburger', cefrLevel: 'A1'}` → 返回有效 JSON 的 `{sentence, explanation}`
- 正常路径: Map 缓存中已有 'hamburger' → 第二次点击跳过 POST
- 边界情况: `POST /api/example {word: 'xylophone'}` → 仍能返回有效例句/解释
- 错误路径: DeepSeek API 超时 → 502 响应 → 前端仅 TTS，不崩溃
- 错误路径: DeepSeek 返回无效 JSON → 解析回退到错误响应
- 集成: 页面刷新后缓存清空（模块重载时 Map 重新初始化）

**验证:**
- 例句端点返回适合儿童的句子（手动审查 5 个测试词汇）
- 缓存阻止同一 Portal 会话内重复 LLM 调用
- LLM 不可用时图鉴仍能以纯 TTS 模式工作

---

- U6. **图鉴 UI：Portal 图标 + 全屏浮层**

**目标:** 在 Portal 页面新增图鉴入口（图标 + 计数），构建全屏浮层按场景分组展示已搜集/未搜集物件，支持 TTS 和 LLM 例句交互。

**需求:** R5, R6, R7, R7a, R7b, R8, R9（前端部分）

**依赖:** U1（API）、U2（SVG）、U5（例句）

**文件:**
- 修改: `src/portal/portal.ts` — 增加图鉴加载、图标渲染、浮层 DOM 构建、事件处理
- 修改: `src/portal/portal.css` — 图鉴图标样式、浮层样式、物件卡片样式、动画 keyframes
- 测试: 手动验证（DOM 密集型，不适合无头测试）

**方案:**
- **API 调用**: Portal 加载时，在已有 `fetch('/api/scenes')` + `fetch('/api/progress')` 并行之后增加 `fetch('/api/collectibles')` 获取已搜集列表。按 `scene_id` 分组，计算每个场景进度。API 失败时图标显示「📖 ?」并禁用点击——不阻塞 Portal 其余部分。
- **图标**: 在 hero 区域 `#star-count` 旁边追加图鉴按钮。HTML：`<button id="compendium-btn">📖 <span id="compendium-count">0</span></button>`。CSS：与星星展示内联，匹配视觉风格（圆角、儿童友好配色）。
- **浮层**: 全屏 fixed div，带背景模糊/暗色遮罩。内容：标题「图鉴」+ 关闭按钮（✕），可滚动主体 + 场景分组区域。
- **加载状态**: 点击图标到 API 数据返回之间，浮层显示简单的加载旋转动画（沿用 Portal 已有的 spinner 模式）。
- **场景区域**: 每个区域有 emoji + 场景名称 + 进度（如「🍽️ 餐厅 3/7」）。物件以网格卡片展示。
- **物件卡片**:
  - 已搜集: 彩色 SVG（从 `getSvgForWord()` 获取）以 innerHTML 嵌入 + 下方单词标签。可点击，触发 TTS + LLM 例句。
  - 未搜集: 灰色 CSS filter SVG 剪影 + 问号标签。不可点击（点击穿透到遮罩不关闭浮层——`stopPropagation` 处理）。
- **零状态**: 没有任何搜集物时，浮层顶部显示友好提示「你还没有找到任何单词！快去场景里探索发现吧 🌟」。
- **TTS**: 点击已搜集物件时：`fetch POST /api/tts {input: word, voice: 'Kiki', speed: 0.75}` → blob → `URL.createObjectURL(blob)` → `new Audio(url).play()`。
- **LLM 例句**: TTS 之后调用 `POST /api/example {word, cefrLevel}`（优先使用缓存）。在物件卡片旁的气泡中展示结果：英文例句在上、中文解释在下。TTS 用相同音频模式朗读例句。LLM 失败时气泡仅显示「例句暂时无法加载」，不阻塞 TTS 发音。
- **气泡**: 相对于被点击物件 absolute 定位。CSS transition 淡入。8 秒后或点击下一个物件时自动关闭。
- **关闭**: 点击遮罩、点击关闭按钮或按 Escape 键 → 隐藏浮层。
- **全部搜集完成**: 当某个场景 7/7 搜集完成时，该区域显示绿色勾号或庆祝标识，提示儿童该场景已探索完整。
- **动画**: 浮层进入使用 CSS `@keyframes` 淡入 + 缩放（与 Portal 已有的 `.entering` 卡片过渡一致）。

**遵循的模式:**
- `src/portal/portal.ts:loadPortal()` — DOM 操作模式、异步数据加载、卡片渲染
- `src/portal/portal.ts:playRandomQuote()` — `new Audio(url)` 模式用于 TTS
- `#portal-loading` — 浮层可见性切换模式
- `sceneEmoji` 映射 — 按 emoji 分组场景
- `.card.entering` — CSS 过渡模式

**验证:**
- Portal 页面星星旁显示 📖 图标 + 正确总数
- 点击图标 → 浮层打开，场景分组和进度数字正确
- 已搜集物件显示彩色 SVG；未搜集物件显示灰色剪影
- 点击已搜集物件 → TTS 播放单词发音
- LLM 例句显示在气泡中；TTS 朗读例句
- 同一单词点击两次 → 不重复调用 LLM（缓存命中）
- 遮罩、关闭按钮、Escape 均可关闭浮层
- 零搜集状态：图标显示「📖 0」，浮层显示友好提示
- API 错误状态：图标仍显示但禁用，不影响 Portal 其余功能

---

- U7. **集成、边界情况加固、润色**

**目标:** 串联所有单元，处理集成过程中发现的边界情况，增加视觉润色，确保 F1→F2→F3 完整流程端到端可用。

**需求:** 全部（集成验证）

**依赖:** U4（场景内搜集）、U6（图鉴 UI）

**文件:**
- 修改: `src/main.ts` — 确保 CollectibleManager 生命周期正确绑定场景加载/卸载
- 修改: `src/portal/portal.ts` — 确保图鉴数据不过期
- 修改: `src/portal/portal.css` — 动画润色、响应式调整
- 修改: `src/engine/collectibles/collect-overlay.ts` — 超时行为、Escape 键处理

**方案:**
- **场景生命周期**: `CollectibleManager` 在 `loadScene()` 中创建，切换场景时在 `unloadScene()` 中销毁。标记从 scene 中移除，距离检测处理器注销。
- **NPC 对话共存**: 验证 E 键不与 Q 键（麦克风）冲突。两个都在 document 上 `keydown` 监听——E 仅在 `activeCollectible` 非 null 时触发，可与 NPC 对话并行（系统完全平行运行）。
- **指针锁定过渡**: E 键退出指针锁定 → 浮层显示 → 确认/关闭 → canvas 可点击恢复指针锁定。验证流程与 CameraController 现有 `onClick` 处理兼容。
- **动画润色**: CSS `@keyframes` 用于搜集浮层进入/退出、图鉴浮层进入/退出。Web Audio 庆祝音效时序对齐 SVG 收缩动画。考虑 `prefers-reduced-motion` 媒体查询（儿童可能对动效敏感）。
- **错误状态**: API 失败时优雅降级，不 crash UI。搜集持久化失败时仍播放庆祝动画但显示「保存失败，请再试一次」。TTS 失败时 SVG 仍展示，喇叭按钮作为重试入口，确认按钮仍可用（用降级回退合成音或无声确认）。
- **响应式**: 图鉴浮层在小视口可滚动。搜集浮层 SVG 参考视口高度百分比缩放。桌面优先但避免小屏布局破损。

**遵循的模式:**
- `src/main.ts:loadScene()` → 组件生命周期模式
- `src/main.ts:animate()` → 含子系统更新调用的渲染循环

**验证:**
- 完整流程: 进入餐厅 → 搜集 2 个物件 → 返回 Portal → 图鉴显示 2 → 点击物件 → TTS + 例句 → 进入另一场景 → 搜集 1 个 → Portal 显示 3 → 餐厅区域显示 2/7，另一区域显示 1/N
- 边界: 搜集物件后立即在确认前关闭浏览器标签 → 重新打开 → 物件仍可搜集
- 边界: 两个搜集物靠近 → 仅最近一个发光 → 略移动 → 另一个发光
- 边界: 快速连按 E → 仅一个浮层实例（去抖）
- 边界: NPC 对话进行中 + 在搜集物旁按 E → 搜集流程独立正常工作
- 残留检查: 进入已 100% 搜集完成的场景 → 全部物件隐藏、无光晕、无 E 提示

---

## 系统级影响

- **交互图:** 新增 E 键监听器在 `document` 上，与已有 Q 键（MicButton）和 WASD（CameraController）共存。距离检测循环新增 `checkCollectibleProximity()` 调用。场景加载新增搜集物标记生成。Portal 页面新增 API 调用和浮层渲染。
- **错误传播:** API 失败（collectibles POST、example POST）记录 console warning；UI 优雅降级。TTS 失败显示重试按钮。无新增未处理 promise rejection。
- **状态生命周期风险:** `userData.collected` 在持久化成功后置为 true——但如果 POST 成功而调用方在更新本地状态前崩溃，物件视觉上仍存在（无害：服务端知道已搜集，下次加载会隐藏）。由于 `better-sqlite3` 同步写入，无部分写入风险。
- **API 表面一致性:** 新增 `GET/POST /api/collectibles` 和 `POST /api/example` 端点。所有已有端点不变。
- **集成覆盖:** 场景脚本（`play.html`）和 Portal（`index.html`）为独立 HTML 页面——跨页面状态完全依赖服务端持久化。这是已有模式（`/api/progress`）。
- **不变性保证:** 现有对话系统、计分系统、场景加载器、NPC 渲染和所有场景配置文件均不修改。`SceneModule` 接口不变。`SessionMachine` 状态不变。所有已有 API 端点不变。

---

## 风险与依赖

| 风险 | 缓解措施 |
|------|----------|
| SVG 映射库覆盖初期较薄（~35 词） | 首字母回退保证零破损状态；库渐进扩展；新场景作者应为新词汇预留 SVG 创建预算 |
| 指针锁定退出/重入对儿童感到突兀 | CSS 平滑过渡；Canvas 点击重锁模式与其他 FPS Web 游戏类似；建议在承诺此交互模式前进行儿童用户测试 |
| Web Audio 合成庆祝音效可能不够自然 | V1 可接受；后续可用预录制素材替换，无需 API 变更 |
| LLM 例句对最小龄段（6 岁）可能不适当 | Prompt 包含年龄护栏；合并前手动审查 10 个测试输出；可按单词禁用 |
| LLM prompt 发送儿童学习数据到 DeepSeek（外部 AI 服务） | 不发送 PII（仅发送词汇 + CEFR 级别）；V1 仅演示用途；面向真实儿童部署前增加隐私披露 |
| V1 无用户隔离——所有访问者共享搜集数据 | 已记录的假设；V1 目标为单人开发/演示模式；多用户部署前增加 localStorage 用户 ID |
| DeepSeek API 限流或成本 | 模块级缓存最小化调用；LLM 不可用时降级为纯 TTS 模式，不阻塞 |
| 确认按钮立即可用可能导致跳过听力 | 确认按钮隐藏到首次 TTS 播放完成；儿童至少听到一次发音才能搜集 |
| E 键交互在 6 岁儿童群体未经验证 | 字母指示器可能对低龄非字母母语儿童不直观；后续迭代可改用图标提示 |

---

## 来源与参考

- **需求文档:** [docs/brainstorms/2026-04-27-collectible-compendium-requirements.md](docs/brainstorms/2026-04-27-collectible-compendium-requirements.md)
- 相关代码: `src/main.ts`（场景编排）、`src/engine/voice/TTSEngine.ts`（TTS）、`server/src/routes/intent.ts`（LLM 代理）、`server/src/routes/db.ts`（SQLite）、`src/portal/portal.ts`（Portal UI）
- 过往经验: `docs/solutions/integration-issues/kitten-tts-web-worker-integration-2026-04-26.md`
