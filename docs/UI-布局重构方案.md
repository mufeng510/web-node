# Web Note 页面布局分析与重构方案

> 状态：**待实施**（本文只做分析与方案，未改动任何代码）。
> 范围：`src/frontend/src/components/layout/`（应用外壳）+ 各页面首屏布局 + `styles/tokens.css` 布局令牌。
> 不在范围：后端 API、编辑器内核（Tiptap）、鉴权逻辑。
> 前序文档：[`UI-布局重构设计.md`](./UI-布局重构设计.md)（上一轮"功能入口归位"，已实施）。本文是**布局/信息架构**层面的第二轮，与前文不重复。

---

## 0. 结论摘要

当前外壳能用，但**不是"难用"，而是"不知道该看哪里"**。核心是三个结构性问题，其余都是它们的派生：

| # | 结构性病因 | 一句话症状 |
|---|---|---|
| **A** | **库信息出现在错误的位置** —— 库切换器被 `justify-between` 推到视觉正中，看起来像页面标题 | 截图里那个"居中的 memo chip"，点它弹下拉；同一个库名在页头又出现一次，路径再出现一次 = 3 份重复 |
| **B** | **左栏把两种语义塞进同一列同一层级** —— 11 项产品级导航 + 某个具体库的目录树，中间只隔一条线 | 用户无法预期"点 Dashboard"和"点 `常见汇总.md`"是同一类操作 |
| **C** | **状态有 4 个真相源且互不同步** —— 路由 / context / localStorage / 组件本地 state | 深链、后退、搜索跳转后，左栏高亮和真实位置对不上 |

派生问题：左栏两个滚动区缺 `min-h-0`、13 个页面各自复制滚动容器、阅读宽度令牌定义了却没接线、导航清单硬编码 3 份（移动端那份还没有 active 态）、文件树键盘不可达、抽屉/弹窗的打开动画是死类。

还有一个结构性问题本文一并处理：**左栏的 11 项里混着两种完全不同频次的关注点** —— 高频的内容导航（Dashboard / Library / Search / Tasks）和低频的应用级配置（Settings / Diagnostics / Users / Audit Log）。设置类项目前是 `Settings.tsx:245-263` 那个**已经带自己章节导航的子页面**，却又在左栏占一行，点进去是「导航套导航」（左栏竖排 → 页面内又是竖排 + `border-r`，长得几乎一样）。

**改造主张**：外壳从「三段顶栏 + 二栏」改为「**两段顶栏 + 三栏 grid + 单一滚动归属**」，并且：

1. **库切换器下沉到左栏顶部**，与 FILES 区物理相邻（它决定文件树的范围）；
2. **左栏只保留内容/工作区导航（4 项）**，设置类全部移出，合并进已有的 `/settings` 子页面，入口收敛到顶栏**头像 + 用户名**菜单；
3. 页头升级为可导航的 PageContextBar；
4. 导航清单与文件树状态各自收敛为单一真相源。

> 第 2 条是一次**信息架构变更**，不是样式调整。它把左栏从"整个应用的功能清单"变成"我正在处理的东西的导航"，这是解决 P0-2 语义混装的唯一办法 —— 只画一条 hairline 不够，混装还在。

---

## 1. 现状解剖（实测）

### 1.1 几何（1996×996 视口，对应截图）

```
0                                                          1996
├─ TopBar 48px ─────────────────────────────────────────────┤
│ [Logo "Web Note"]      [▤ memo]           [Search… ][🔔][✎][⚙][⏻] │
├─ 256px ─────┬──────────────────────────────────────────────┤
│ LeftSidebar │ PageHeader: memo / /data/memo      [+ New Library] │
│  nav ×11    ├──────────────────────────────────────────────┤
│ ─ Files ─   │                                              │
│  tree       │        ( 空白 )                               │
│             │            [空态: Welcome to memo]            │
│             │             [New Note] [Browse Files]         │
└─────────────┴──────────────────────────────────────────────┘
   x=253                                          x=1996
```

内容区可用宽度 ≈ **1740px**（无 max-width 上限）。

### 1.2 代码坐标

| 区域 | 文件 | 关键行 |
|---|---|---|
| 壳层根 | `components/layout/Layout.tsx` | `45` `min-h-screen flex flex-col`；`55` `flex-1 flex overflow-hidden`；`56` MobileDrawer；`64` LeftSidebar；`66` `<main>`；`71` BottomNav |
| 顶栏 | `components/layout/TopBar.tsx` | `92` `<header>` `h-[var(--topbar-h)] ... justify-between px-4 lg:px-6`；`94` ☰；`99-106` Logo；`109-184` 库切换器；`187-250` 右区 5 控件 |
| 左栏 | `components/layout/LeftSidebar.tsx` | `162` `<aside>` `w-[var(--sidebar-w)] flex flex-col`；`168-210` nav（11 项字面量）；`211-223` FILES 头；`224-234` 文件树 |
| 抽屉 | `components/layout/MobileDrawer.tsx` | `96` `<nav>` `flex-1 ... overflow-y-auto`；`97-120` 硬编码清单；`124` `<Link>`（无 active） |
| 底栏 | `components/layout/BottomNav.tsx` | `22` `<nav>` `aria-label="Primary"` |
| 页头 | `components/ui/PageHeader.tsx` | `12` `p-4 border-b`；`15` `<h1>`；`16` description `truncate` |
| 空态 | `pages/Dashboard.tsx` | `159-168` PageHeader；`170-186` EmptyState |
| 布局令牌 | `styles/tokens.css` | `69-76` 8 个布局常量（其中 4 个零引用） |

### 1.3 四个真相源（问题 C 的证据）

| 关注点 | 真相源 | 位置 | 随路由同步？ |
|---|---|---|---|
| 当前库（身份） | 路由参数 `:libraryId` | `App.tsx:119-120` → `Editor.tsx:50` | — |
| 当前库（选择） | Context + `localStorage` | `Layout.tsx:15,27-34`；`useLibraries.tsx:43-146` | ❌ `Layout.tsx:18-25` 的 effect 只在"库已失效"时兜底，**不读 URL** |
| 左栏树的数据源 | `currentLibrary` prop | `Layout.tsx:64` → `LeftSidebar.tsx:53-82` | ❌ |
| 文件选中项 | 组件本地 `useState` | `LeftSidebar.tsx:50`，仅由点击写入（`98`） | ❌ **完全不从路由派生** |
| 导航高亮 | 路由 | `LeftSidebar.tsx:193-208`（`NavLink`） | ✅ |

关键证据：
- `LeftSidebar.tsx:19` 只 import 了 `NavLink, useNavigate` —— **没有** `useParams` / `useLocation`。
- `Layout.tsx:13` 声明了 `const location = useLocation()` 却**全文未使用**（死代码，正是被放弃的"路由→树同步"留下的痕迹）。

---

## 2. 问题清单

> 分级：**P0** = 结构性，必须改；**P1** = 层级/视觉，改了明显变好用；**P2** = 密度/响应式/无障碍，可批量处理。

### P0-1 顶栏"伪居中"的库切换器

- **现象**：库切换 chip 落在视口水平正中（x≈700–780），距左侧 Logo 约 600px、距右侧搜索框约 790px，两侧不等距。
- **证据**：`TopBar.tsx:92` 父级 `justify-between`；`109` 切换器容器 `flex items-center gap-3 flex-1 lg:max-w-xs`。`justify-between` + `flex-1`（上限 320px）会让剩余空间平分到两侧，chip 自身在 320px 容器内左对齐 → **视觉居中是 flex 分布的副产物，不是设计意图**。
- **根因**：把"全局上下文选择器"放在了视觉上属于"页面标题"的位置。
- **影响**：
  - 点击行为与位置暗示相反 —— 用户以为是标题（以为在讲当前页），点下去弹下拉。
  - 同一库名在页头 `Dashboard.tsx:160` 再出现一次、路径 `161` 再出现一次 → **3 份重复**。
  - Logo 与 chip 之间 600px 空白 + 右侧 5 控件 → 顶栏读起来是"三个孤岛"，没有主次。

### P0-2 左栏混装产品导航与库目录树

- **证据**：`LeftSidebar.tsx:168-210`（11 项导航）与 `224-234`（目录树）同处一个 `<aside>`，中间只有 `211` 的 `FILES` 小标题 + `border-b`。`FILES` **只写了标签，没写"这些文件属于哪个库"** —— 而唯一的库上下文在 700px 外的顶栏。
- **影响**：
  1. **语义混淆**：一列里混着"去某功能页"（无副作用）和"打开某文件"（改变编辑器内容），点击成本与预期不匹配。
  2. **无范围感**：用户不知道树里是不是全部文件、当前库有多少、是否被 `showHidden` 过滤（后端 `files/routes.ts:30-37` 有 `showHidden`/`showObsidian`/`showGit` 开关，前端无任何提示）。
  3. **无库时仍显示 FILES 头**（`211-223` 的条件只在 `+` 按钮上），出现空的分隔标题。

### P0-3 左栏两个滚动区 + 导航挤压文件树

- **证据**：`169` nav `overflow-y-auto`；`224` 树 `flex-1 overflow-y-auto p-2`；`<aside>`（`162-167`）自身不滚 → **上下两个独立滚动区**，中间夹一个不滚的 FILES 头（`211-223`）。
- **缺陷 a（导航挤压文件树 —— 实测确认）**：导航 11 项固定占 399px 且不可收缩。视口压矮时文件树被挤到几乎消失：

  | 视口高 | aside 高 | nav 高 | 文件树可视高 | 文件树内容高 |
  |---|---|---|---|---|
  | 996 | 948 | 399（不滚） | 499 | 499（不需滚） |
  | 600 | 552 | 399（不滚） | 103 | 379（滚动） |
  | 400 | 352 | 286（滚动） | **16** | 379（滚动） |
  | 300 | 252 | 186（滚动） | **16** | 379（滚动） |

  → 矮视口下文件树只剩 16px，等于不可用。这才是本条的**真实病因**，由 **B2.5** 修（导航 `flex: 0 0 auto` 不滚，文件树独占剩余空间）。
- **缺陷 b（横向抖动）**：全项目 `grep scrollbar-gutter` → **0 命中**。树从空变有内容时导航区宽度变化。→ **B0.4 已修**（实测 computed `scrollbar-gutter: stable`）。
- **缺陷 c（选中项可能在视口外）**：无滚动位置记忆、无 `scroll-margin` / `scrollIntoView`。截图中 `常见汇总.md` 高亮位于 y≈576，正在长列表底部 —— 这就是"打开文件后看不到自己在哪"的直接证据。→ **B2.6 / B2.8**。

> ⚠️ **原 P0-3a「缺 `min-h-0` 导致内容被裁掉且无滚动条」是错的，已撤回。**
>
> 原判断：`flex-1` 无 `min-h-0` → flex 子项默认 `min-height: auto` → 拒绝收缩 → 被 `overflow-hidden` 裁掉。
>
> **实测反证**：在 400px 视口下移除文件树的 `min-h-0`，`clientHeight` 仍是 16px、`scrollHeight` 379px、最后一个文件项仍可滚达 —— 与保留 `min-h-0` 完全一致。
>
> **根因**：CSS Flexbox 规范规定，自动最小尺寸（`min-height: auto`）**仅对 `overflow: visible` 的 flex 项生效**。一旦声明 `overflow-y: auto`，该元素即成为滚动容器，自动最小尺寸本就为 0。所以 `flex-1 overflow-y-auto`（`LeftSidebar.tsx:224`、`MobileDrawer.tsx:96` 及 11 个页面容器）**原本就能正常收缩**。
>
> B0.3 加的 `min-h-0` 因此是**防御性冗余**，不是修复 —— 保留它可以防止后人删掉 `overflow-*` 后无声退化，但不应被记作 bug fix。真正需要 `min-h-0` 的是**没有** `overflow` 声明的纯 flex 项。

### P0-4 状态四源打架（路由 / context / localStorage / 本地 state）

可复现的行为差异：

| 操作 | 导航高亮 | 文件树高亮 | 树里的库 |
|---|---|---|---|
| 点击树里的文件 | ✅ 变 | ✅ 变 | ✅ 当前库 |
| 浏览器后退 / 前进 | ✅ 变 | ❌ **不变** | ✅ |
| 刷新深链 `/editor/:id/笔记/x.md` | ✅ 变 | ❌ **丢失** | ⚠️ 靠 localStorage 猜 |
| 从搜索结果打开**另一个库**的文件（`Search.tsx:163`） | ❌ Library 项**灭掉** | ❌ 不变 | ❌ **显示错误的库** |
| 展开态 | — | ❌ 切库即清空（`62`）、刷新即丢 | — |

- **根因**：没有单一真相源，也没有任何同步逻辑。`Layout.tsx:13` 的死代码 `location` 说明这条路曾经尝试过但放弃了。

### P1-5 顶栏控件图标化到无法自解释

- **证据**：`TopBar.tsx:213-249` 右区 4 个纯图标控件（铃铛 `213`、新建笔记 `231`、设置 `238`、登出 `246`），全部 20px，**无 tooltip** —— `components/ui/Tooltip.tsx` 存在但此处未用。
- 具体问题：
  - "新建笔记"用 `NotebookPen`（`235`），**与 Logo 图标相同**（`104`）→ 图标语义被稀释。
  - "设置"（`238`）与左栏 `Settings`（`LeftSidebar.tsx:182`）重复入口。
  - 无用户身份锚点（没有头像/邮箱），登出按钮直接裸露在顶栏。
- **目标态**：设置类入口收敛为一个**可见的用户身份块**（头像 + 用户名 + 角色），点击展开菜单；主题保留为独立的可见快速切换（因为自托管 NAS 用户常要调字号/主题，见 §3.1 第 6 条）。

### P1-6 同一功能 2–4 个入口，导航清单硬编码 3 份

| 副本 | 位置 | 用 `routes` 对象？ | 有 active 态？ |
|---|---|---|---|
| 桌面左栏 | `LeftSidebar.tsx:172-189` | ✅ | ✅ `NavLink` |
| 移动抽屉 | `MobileDrawer.tsx:97-120` | ❌ 硬编码 `'/search'` 等 | ❌ **完全没有**（`124` 用 `<Link>`） |
| 移动底栏 | `BottomNav.tsx` | ❌ 硬编码 | 部分 |

- Settings 出现在 4 处（左栏 / 抽屉 / 底栏 / 顶栏 `238`）；Notifications 2 处（左栏 `178` / 顶栏 `213`）。
- **影响**：改一次导航要改 3 个文件，**已经漂移**（移动端无高亮就是漂移的产物）。后续任何布局调整都会放大这个成本。
- **目标态**：Settings / Diagnostics / Users / Audit Log / MCP Tokens **左栏与底栏都不出现**，只在顶栏用户菜单里（唯一入口）；Dashboard / Search / Notifications / Tasks / AI Assistant 保留左栏（Notifications 另有顶栏铃铛作为第二入口，可接受）。左栏另删除 `Library` 项（见 §3.2）。

### P1-7 空态与页头争夺重心，同屏两个 primary CTA

- **证据**：页头右侧 `Button size="sm"` "New Library"（`Dashboard.tsx:163-166`）与页面正中 `Button size="lg"` "New Note"（`176-179`）**都是 primary 色**。
- **现象**：页头贴在左上（y≈72–115），空态在几何中心（y≈460–680），中间 1000px+ 完全空白 → 两块视觉重心脱节。
- **影响**：第一眼落在空态（几何中心），但"新建笔记"和"新建库"是**不同层级**的工作（对已有库 vs 对整个应用），同屏同权重竞争没有意义。

### P1-8 页头副标题是服务器绝对路径

- **证据**：`Dashboard.tsx:161` `description={currentLibrary.path}` → 渲染 `/data/memo`；`PageHeader.tsx:16` 还带 `truncate`。
- **影响**：容器内部路径泄漏到 UI；不可点、不可复制、不能当导航；对"我的笔记在哪"零回答价值。

### P1-9 单库时库切换器退化成"看得见点不动"的 chip

- **证据**：`TopBar.tsx:110` `libraries.length > 1` 才渲染可点击 `<button>`；`176` 单库时渲染成**不可点击的 `<div>`**，但样式（`Library` 图标 + `bg-bg-elevated border border-border rounded-md`）与可点版本几乎一致。
- **截图里的"居中 chip"就是这一支**（`libraries.length === 1`）。**同一视觉形态对应两种行为**，这比"居中"更严重。

### P2-10 阅读宽度令牌定义了却没接线

- **证据**：`tokens.css:75-76` 定义 `--content-max-w: 48rem` / `--editor-max-w: 56rem`；`grep` 全项目 → **只有定义，0 引用**。`Layout.tsx:66` main 只有 `flex-1 min-w-0 overflow-hidden`，无 `max-width`。
- **影响**：1996px 视口下正文宽 ≈ 1740px，长文行长远超可读上限（中文 40+ 字/行）；编辑器同样。

### P2-11 左栏固定 256px、不可调、不支持折叠

- **证据**：`tokens.css:70` `--sidebar-w: 16rem`；`LeftSidebar.tsx:164` 无宽度状态。`tokens.css:71` `--sidebar-w-collapsed: 3.5rem` **零引用**（折叠功能被设计过但没实现）。
- **影响**：深层目录缩进 `paddingLeft: 12 + depth*16`（`LeftSidebar.tsx:118`），depth 6 就超出 256px；长文件名只能 `truncate`（`151`）且无 tooltip；无法给"只需要主内容"的场景腾空间。

### P2-12 壳层用 `vh` + `overflow-hidden` 兜底，滚动容器 13 处复制

- **证据**：`Layout.tsx:45` `min-h-screen`（= `100vh`，非 `dvh`）；`55` `overflow-hidden`；`66` main `overflow-hidden`。而每个页面各自实现 `flex-1 flex flex-col min-h-0` + `flex-1 overflow-y-auto`（`Audit.tsx:96`、`Search.tsx:138`、`Settings.tsx:247`、`MCP.tsx:142`、`Tasks.tsx:112`、`Users.tsx:194`、`Notifications.tsx:101`、`Diagnostics.tsx:240`、`AI.tsx:379`…）。
- **影响**：
  1. `vh` 不含移动端浏览器 UI 高度 → 移动端高度偏差。
  2. **任何页面漏写内部滚动容器 → 内容被 `overflow-hidden` 裁掉且无滚动条**（不可发现的失败模式），而不是优雅降级。
  3. 13 处重复，`min-h-0` 靠人肉记忆 → 已漏（`LeftSidebar` 就是）。
  4. `Editor.tsx:375-417` 在 split 模式下外层 `overflow-hidden` + 两个内层 `min-h-0 overflow-auto`（`393`/`408`）→ 一个内容区里两条并排滚动条。

### P2-13 图标尺寸与选中态不统一

- 顶栏 `w-5 h-5`（`TopBar.tsx:220`/`242` 用 `[&_svg]:w-5`）、左栏导航 `w-4 h-4`（`LeftSidebar.tsx:205`）、文件树 `w-4`（`139`/`147`/`149`）→ 混用 20px/16px。
- 文件树图标色**恒为 `text-fg-muted`**（`147`/`149`），选中时不变色 → 选中态只靠底色 + 文字色，弱。
- 无左侧选中指示条；`LeftSidebar.tsx:201` 与 `115` 都只有 `bg-primary/10 text-primary`。

### P2-14 z-index 无 scale，靠 DOM 顺序解冲突

| 值 | 使用者 |
|---|---|
| `z-50` | `TopBar.tsx:142`（库下拉）、`MobileDrawer.tsx:59`（抽屉面板）、`Dialog.tsx:131`（遮罩）/`185`（内容） |
| `z-40` | `BottomNav.tsx:24`、`MobileDrawer.tsx:55`（遮罩） |

抽屉面板与库下拉同为 `z-50`、遮罩与底栏同为 `z-40`，仅因 `MobileDrawer` 在 DOM 中靠后（`Layout.tsx:56` 在 `TopBar` 之后）才没冲突 —— 脆弱。

### P2-15 抽屉/下拉/弹窗的打开动画是死类

- `animate-in fade-in-0 zoom-in-95` / `slide-in-from-left` 用于 `TopBar.tsx:142`、`MobileDrawer.tsx:55,59`、`Dialog.tsx:131,185`。
- 全项目 `grep @keyframes` → **0 命中**；`tailwind.config.js:51` `plugins: []`；未安装 `tw-animate-css`。
- → 这些类**当前是空操作**，所有浮层的打开/关闭过渡实际不存在。

### P2-16 零全局快捷键（而依赖已就位）

- 全项目快捷键仅：`Escape` 关闭菜单（`TopBar.tsx:55-60`、`MobileDrawer.tsx:37-44`、`Dialog.tsx:116-118`）、元素级 `Enter`/`Space`（`LeftSidebar.tsx:120-122`）。**无任何 `metaKey`/`ctrlKey` 组合**。
- `package.json` 有 `cmdk@^1.0.0`、`zustand@^5.0.0` 但**零 import**；`components/command-palette/`、`stores/`、`file-tree/` 三个目录**都是空的**。
- → 命令面板是"脚手架已铺好、内容为空"的状态。

### P2-17 无障碍缺口

| 问题 | 证据 |
|---|---|
| 无 skip link | 全项目仅 `Spinner.tsx:25` 用了 `sr-only` |
| 路由切换不移动焦点、不播报 | `Layout.tsx:18-25` 的 effect 只同步库；无 `focus()`、无 `aria-live` |
| **文件树键盘不可达** | `role="treeitem"`（`LeftSidebar.tsx:123`）但容器 `224` 无 `role="tree"`、节点是 `<div>` 无 `tabIndex` → **Tab 永远到不了**，`120` 的 `onKeyDown` 永不触发 |
| 重复地标名 | 抽屉打开时 `BottomNav.tsx:22` 与 `MobileDrawer.tsx:96` 同时暴露 `aria-label="Primary"`（三个 `<nav>` 都叫 Primary） |
| 抽屉无焦点陷阱 / 无 body 锁 | `MobileDrawer` 无（对比 `Dialog.tsx:120-124` 有） |
| Editor 路由无 `<h1>` | Editor 用自绘头（`262`），未用 `PageHeader`（`PageHeader.tsx:15` 是唯一渲染 `h1` 的地方） |

---

## 3. 目标布局

### 3.1 设计原则

1. **一个事实只出现一次**：当前库的身份只在**左栏顶部**声明一次；顶栏显示的是"我在哪"（面包屑），不是"我是什么"。
2. **同列同语义**：左栏只放**内容/工作区**导航 + **当前库的文件树** —— 两者都回答"我在处理什么"。应用级配置不进左栏。
3. **按频次分层，不按功能分层**：高频内容操作留在左栏；低频应用配置收进 `/settings` 子页面；身份相关（切换账号、登出）收进用户菜单。
4. **单一真相源**：库身份 → 路由；导航清单 → 单一 config；文件选中/展开 → 路由派生；设置项归属 → 单一 registry。
5. **每块区域恰好一个滚动容器**，宽度由父容器约束，不由内容撑开。
6. **可发现性不能靠牺牲换简洁**：这是本方案唯一的自我约束条款。自托管 NAS 场景下，主题 / 字号 / 语言这类设置普通用户真的会用 —— 所以移出左栏的同时，顶栏必须保留**可见**的身份块与主题快速切换，且用户菜单里的"外观"项要能**深链到具体章节**（`/settings?tab=appearance`），而不是只丢一个笼统的"设置"入口。
7. **主内容有阅读宽度上限**（激活 `--content-max-w`），超宽屏用留白而不是无限拉伸。

### 3.2 目标线框（桌面 ≥1280px）

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TopBar 48px                                                                 │
│ [☰][📓 Web Note] │  memo › 笔记 › 常见汇总.md   │ [⌘K 搜索…] [🔔] [+] [🌗] │
│                                                          [👤 Jerry (admin) ▾]│
├─────────────┬─────────────────────────────────────┬───────────────────────┤
│ Nav  256px  │ PageContextBar (sticky)            │  Aside 320px          │
│ 折叠 → 56px ├─────────────────────────────────────┤  (可选，激活          │
│  ⚡ 单一语义 │                                     │   --right-sidebar-w)  │
│             │  ┌ ScrollArea（唯一滚动容器）┐      │  AI / 大纲 / 反链      │
│  工作区      │  │                             │      │                       │
│   Dashboard │  │   内容（max 896px 居中）      │      │  ← 按页面显隐        │
│   Search    │  │                             │      │                       │
│   Tasks     │  └─────────────────────────────┘      │                       │
│   AI Assistant                                     │                       │
│─────────────│ ← hairline 分隔：导航 | 内容，不是同类项                     │
│ 📚 memo  ▾ │ ← 库切换器（唯一的库身份声明）+ [+]新建                      │
│   ⟢ active  │ ← 路由在 /editor/* 时本区块显示 active 指示（替代原 Library 项）│
│ [🔍 过滤文件]│                                     │                       │
│ ▾ Blog      │ ← ScrollArea #2（min-h-0，sticky 文件头）                    │
│   常见汇总   │                                     │                       │
│ ▸ Prompt    │                                     │                       │
│ ▸ 备忘录     │                                     │                       │
└─────────────┴─────────────────────────────────────┴───────────────────────┘
   256px            flex: 1                            320px

                  ↖ 点击 [👤 Jerry ▾] 展开：
┌──────────────────────────────────────┐
│ Jerry · jerry@local   role: admin     │
├──────────────────────────────────────┤
│ 👤 切换账号                           │
│ 🌗 外观（Light / Dark / System）      │
│ ⚙ 设置…            → /settings        │
│    ↳ 外观           → ?tab=appearance │
│    ↳ 账号与安全     → ?tab=security   │
│ ────────────────────────────────    │
│ 系统                                │
│ 🩺 诊断             → /settings?tab=diagnostics │
│ 👥 用户             → /settings?tab=users       │
│ 📜 审计日志         → /settings?tab=audit        │
├──────────────────────────────────────┤
│ ↪ 登出                               │
└──────────────────────────────────────┘

        ↖ 点进 /settings 之后（子页面已有竖 Tab，扩成分组）
┌────────────────────────────────────────────────────────────┐
│ Settings                                       [PageHeader] │
├──────────────┬─────────────────────────────────────────────┤
│ 个人         │                                             │
│  账号        │   Account 内容区                             │
│  安全        │                                             │
│  外观        │   （竖向章节导航已有：Settings.tsx:250-263，   │
│ 系统         │     只是从 4 项扩为 7 项并加分组标题）         │
│  诊断        │                                             │
│  用户        │                                             │
│  审计日志    │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

**左栏为什么只剩 4 项**

| 原左栏项 | 归属 | 理由 |
|---|---|---|
| Dashboard | **留左栏** | 高频落点 |
| **Library** | **删除** | 指向 `/editor/:id`（无路径 = 欢迎草稿，`App.tsx:119`），而文件树就在它正下方 —— 冗余入口。active 指示改由 Files 区块头部承担 |
| Search | **留左栏** | 高频 |
| Notifications | **留左栏** | 高频（顶栏铃铛保留同一目标的第二个入口，可接受） |
| Tasks | **留左栏** | 高频 |
| AI Assistant | **留左栏** | 核心定位，高频 |
| MCP Tokens | → `/settings?tab=mcp` | 低频、配置性质 |
| **Settings** | **移出左栏** → 顶栏用户菜单 | 它本身就是带章节导航的子页面，左栏这行是"导航套导航" |
| Diagnostics | **移出左栏** → 用户菜单「系统」组 | 低频、运维性质 |
| Users\* | **移出左栏** → 用户菜单「系统」组 | 仅 admin，低频 |
| Audit Log\* | **移出左栏** → 用户菜单「系统」组 | 仅 admin，低频 |

11 → **6** 项（含 Library 删除）。若 MCP Tokens 也觉得低频，可一并移入 → 5 项。

**与现状的关键差异**：

| # | 变化 | 解决的问题 |
|---|---|---|
| 1 | 顶栏改两段式：左 = ☰ + Logo + **面包屑**；右 = ⌘K 搜索 + 通知 + 新建 + **主题快速切换** + **可见身份块**（头像+用户名+角色） | P0-1、P1-5 |
| 2 | **库切换器从顶栏下沉到左栏顶部**，与 FILES 区物理相邻 | P0-1、P0-2、P1-9 |
| 3 | **设置类全部移出左栏**（Settings/Diagnostics/Users/Audit/MCP），左栏只留内容导航；入口收敛到用户菜单 | P0-2、P1-6 |
| 4 | `/settings` 章节导航从 4 项扩为 7 项并加「个人 / 系统」分组；支持 `?tab=` 深链 | P0-2 |
| 5 | 删除左栏 `Library` 项，Files 区块头部承担 `/editor/*` 的 active 指示 | P1-6 |
| 6 | 导航区 `flex: 0 0 auto`（自身不滚）+ 文件区独占剩余空间并独立滚 | P0-3 a |
| 7 | 两个滚动区统一 `scrollbar-gutter: stable` + `overscroll-behavior: contain` | P0-3 c |
| 8 | 文件树选中项/祖先展开态**从路由派生**，打开文件自动 `scrollIntoView({block:'nearest'})` | P0-3 d、P0-4 |
| 9 | PageHeader → **PageContextBar**：面包屑可点、路径可复制、右侧**只保留 1 个 primary** | P1-7、P1-8 |
| 10 | 内容区 `max-inline-size: var(--content-max-w)` 居中 | P2-10 |
| 11 | 壳层固定高 `100dvh` + 两行 grid（B0 已落地）；第三栏 `grid-template-areas` 随右栏在 B4.2 接入 | P2-12 |
| 12 | 左栏可折叠为 56px rail（激活 `--sidebar-w-collapsed`）、可拖拽调宽 | P2-11 |

### 3.3 响应式断点

| 断点 | 布局 |
|---|---|
| `<768px` | 单栏。左栏 → 抽屉（≥288px）。抽屉内导航 = 左栏 6 项 + 一个「⚙ 设置」入口（保证移动端可发现）。无右栏。 |
| `768–1279px` | 单栏 + 可折叠 rail（默认折叠 56px）。内容 `max-inline-size: 100%`。 |
| `≥1280px` | 三栏 grid：`256px / 1fr / auto(320px)`。右栏按页面显隐。 |
| `≥1920px` | 左栏可拖拽至 320px；内容仍受 `--content-max-w` 约束（**不再无限拉伸**）。 |

### 3.4 布局令牌（新增 / 激活）

```css
/* 激活：tokens.css 中已定义但零引用的四个 */
--content-max-w: 48rem;         /* 768px  阅读宽度上限 */
--editor-max-w:  56rem;         /* 896px  编辑宽度上限 */
--sidebar-w-collapsed: 3.5rem;  /* 56px   rail */
--right-sidebar-w: 20rem;       /* 320px  右栏 */

/* 新增：z-index scale（替代裸 z-40 / z-50） */
--z-base: 0; --z-sticky: 10; --z-header: 20;
--z-scrim: 30; --z-drawer: 40; --z-modal: 50; --z-toast: 60;

/* 新增：壳层 */
--shell-h: 100dvh;              /* 替代 min-h-screen + vh */
/* 导航区宽度沿用契约值 --sidebar-w: 16rem (256px)，不新增 --nav-w。
   若确实要收到 240px，必须同步改 DESIGN.md:202 的令牌契约。 */

/* 每个 ScrollArea */
scrollbar-gutter: stable;
overscroll-behavior: contain;
```

> `--space-*` / `--text-*` / `--leading-*`（`tokens.css:25-39,42-50`）**仍未接入** `tailwind.config.js` 的 `theme.extend`，实际生效的是 Tailwind 默认刻度。建议本轮一并接入或明确删除，避免"两套间距并存"。

---

## 4. 新增 primitive（4 个）

| 组件 | 位置 | 职责 | 消除的重复 |
|---|---|---|---|
| `ScrollArea` | `components/ui/ScrollArea.tsx` | 唯一滚动容器：`min-h-0` + `scrollbar-gutter: stable` + `overscroll-behavior: contain` + 可选 sticky header | **13 个页面**各自实现的 `flex-1 overflow-y-auto` |
| `Breadcrumb` | `components/ui/Breadcrumb.tsx` | 层级路径：`nav > ol > li`，末项 `aria-current="page"`，中间项可点 | `Editor.tsx:272-277` 与 `Dashboard.tsx:249-276` 两份内联实现 |
| `DropdownMenu` | `components/ui/DropdownMenu.tsx` | 用原生 `<dialog>`/popover + anchor 定位，**进 top layer，不需 z-index**；支持分组标题、危险项（`dangerous` 不进快捷流）、`?tab=` 深链项 | `TopBar.tsx:43-67,138-172` 手写菜单；顺带解掉 P2-14 的 z-50 冲突；并作为 B3.2 `UserMenu` 与 B2.6 `LibrarySwitcher` 的底座 |
| `Resizable` | `components/ui/Resizable.tsx` | grid + `resize` 手柄 + `role="separator"` + 键盘调节 + 双击复位，宽度写入 CSS 变量 | 目前无（左栏宽度、Editor split 50/50 均不可调，`Editor.tsx:376`） |

**新增的应用级组件**（不属于 primitive，一并列出以免遗漏）：

| 组件 | 位置 | 职责 |
|---|---|---|
| `UserMenu` | `components/layout/UserMenu.tsx` | 顶栏身份块 + 下拉菜单：身份区、切换账号、外观快速切换、设置子项（深链 `?tab=`）、「系统」分组、登出。由 `SETTINGS_GROUPS` 派生（B3.2） |
| `LibrarySwitcher` | `components/library/LibrarySwitcher.tsx` | 左栏顶部的库切换器，单库/多库**同一形态**（永远可点）（B2.6） |
| `TreeView` / `TreeNodeItem` | `components/file-tree/` | 文件树，键盘可达（B2.7） |

**同时要做的两件清理**：
- 把文件树从 `LeftSidebar.tsx`（类型 `26-37`、取数 `53-82`、渲染 `105-159`）抽到 `components/file-tree/`（**目录已存在，空**）。
- 把 `TopBar.tsx:43-67` 的手写下拉（`mousedown` + `Escape` + 手动 `focus()`）换成 `DropdownMenu`。

---

## 5. 状态收敛方案

### 5.1 导航清单单一化（拆成两个 registry）

设置类移出左栏后，导航信息需要**两个**注册表，而不是一个被硬砍一半的清单。

新建 `src/frontend/src/components/layout/navConfig.tsx`：

```ts
/* ── registry 1：左栏 / 抽屉 —— 只放内容与工作区 ── */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}
export const WORKSPACE_NAV = (libraryId?: string): NavItem[] => [
  { to: routes.home,               label: 'Dashboard',   icon: Home,           end: true },
  { to: routes.search,             label: 'Search',      icon: Search },
  { to: routes.notifications,      label: 'Notifications', icon: Bell },
  { to: routes.tasks,              label: 'Tasks',       icon: ClipboardList },
  { to: routes.ai,                 label: 'AI Assistant', icon: Bot },
].filter(Boolean);

/* ── registry 2：/settings 章节 —— 个人 + 系统 ── */
export interface SettingsSection {
  id: string;                       // 对应 ?tab=
  label: string;
  icon: LucideIcon;
  render: () => JSX.Element;        // 现 Settings.tsx:269-416 的分支体
  adminOnly?: boolean;
}
export const SETTINGS_GROUPS: { id: string; label: string }[] = [
  { id: 'personal', label: '个人' },
  { id: 'system',   label: '系统' },
];
/* 个人：account / security / appearance
   系统：diagnostics / users(admin) / audit(admin) / mcp      */
```

派生规则（全部从 registry 生成，禁止第二处硬编码）：

| 消费者 | 派生方式 |
|---|---|
| `LeftSidebar` | `WORKSPACE_NAV()` |
| `MobileDrawer` | `WORKSPACE_NAV()` + 末尾一个「⚙ 设置」入口（保证移动端可发现，见 §3.1 第 6 条） |
| `BottomNav` | `WORKSPACE_NAV()` 取 `primary` 项（Dashboard / Search / Tasks / 新建 / 设置） |
| `UserMenu` | `SETTINGS_GROUPS` → 「个人」「系统」两组 + 登出 |
| `Settings.tsx` | `SETTINGS_GROUPS` → 章节导航 + `?tab=` 同步 |
| ⌘K 命令面板 | 两者合并（导航跳转 + 设置跳转） |

顺带修好：抽屉改用 `NavLink` → 恢复 active 态；底栏与桌面自动同源。

### 5.2 章节导航从"Tab state"升级为"URL state"

现状：`Settings.tsx:40` `useState<SettingsTab>`（`'account'|'security'|'appearance'|'advanced'`，`16` 行），**刷新即丢失、不可分享链接**。

改为：`activeTab` 从 `useSearchParams()` 读 `?tab=` 派生（默认值 `account`），章节切换时写回 URL。带来的能力：

- 用户菜单的「外观」项可以深链到 `/settings?tab=appearance`（§3.1 第 6 条要求）；
- `/settings` 与 `/settings?tab=users` 都能被直接访问，菜单里的「系统」组每一项都是独立可分享链接；
- 前进/后退在章节间生效。

**注意**：`advanced` 章节（`Settings.tsx:416`）含删库等危险操作。建议把它并入 `system` 分组但**保持独立 tab 且默认折叠**，并在 registry 里标 `dangerous: true`，让命令面板与用户菜单**不暴露**这一项 —— 危险动作只进 UI，不进快捷流。

### 5.3 文件树状态路由化

```
真相源 = 路由
  /editor/:libraryId/*      → 当前库 + 当前文件路径（splat）
  /editor/:libraryId        → 当前库，无选中文件
```

`LeftSidebar` 改为：

1. `useParams()` 取 `:libraryId` 与 splat → `libraryId` 与 `selectedPath`。
2. `libraryId !== currentLibrary?.id` 时**在同一个 `useEffect` 里**把路由同步到 context（或反过来让 context 完全从路由派生、localStorage 只作 fallback）—— 二选一，但必须有唯一同步点。
3. `selectedPath` 从路由派生，删掉本地 `useState`（`LeftSidebar.tsx:50`）。
4. `expanded` 自动补齐 `selectedPath` 的祖先链，其余保留用户手动状态；按库分键持久化到 `localStorage`（`expanded:<libraryId>`）。
5. 文件树请求依赖从 `library?.id` 改为 `libraryId`，并补**变更后刷新**（当前只在切库时取一次，`LeftSidebar.tsx:82` 依赖数组只有 `library?.id`）—— 新建/重命名/删除笔记后树是陈旧的。

### 5.4 库切换器收口

- 唯一实现放在左栏顶部（`components/library/LibrarySwitcher.tsx`，**目录已存在，空**）。
- `TopBar` 移除 `109-184`；单库/多库用**同一形态**（永远可点），单库时菜单里只有一项并标注"唯一库" —— 消灭 P1-9。
- `localStorage` 只写一处（当前 `Layout.tsx:31` 与 `useLibraries.tsx:49-56` **重复写**同一个键）。

---

## 6. 改造任务清单

> 每批独立可合、可验证；建议按顺序做，B0 的 `ScrollArea` 是 B2 的前置。

### B0 · 地基（不改视觉，先补缺）

| # | 任务 | 文件 |
|---|---|---|
| B0.1 | 加 z-index scale，替换全部裸 `z-40`/`z-50` | `styles/tokens.css`；`TopBar.tsx:142`、`MobileDrawer.tsx:55,59`、`BottomNav.tsx:24`、`Dialog.tsx:131,185` |
| B0.2 | 壳层 `min-h-screen` → `h-[var(--shell-h)]`（激活 `--shell-h: 100dvh`）；外层 `flex flex-col` → `grid grid-rows-[var(--topbar-h)_minmax(0,1fr)] overflow-hidden`，行容器补 `min-h-0` | `Layout.tsx:45,55,66` |
| B0.3 | 滚动容器补 `min-h-0`（**防御性冗余**，非 bug fix —— 见 P0-3 撤回说明：已有 `overflow-*` 的滚动容器不需要它） | `LeftSidebar.tsx:224`、`MobileDrawer.tsx:96` |
| B0.4 | 新建 `ScrollArea` 并让所有滚动区加 `scrollbar-gutter: stable` + `overscroll-behavior: contain` | 新 `ui/ScrollArea.tsx` + 13 个页面 |
| B0.5 | 修死动画类：装 `tw-animate-css` 或删掉 `animate-in*` / `slide-in-from-*` | `tailwind.config.js`、`TopBar.tsx:142`、`MobileDrawer.tsx:55,59`、`Dialog.tsx:131,185` |
| B0.6 | `--space-*` / `--text-*` **接入** `theme.extend`（已实测与 Tailwind 默认刻度 1:1 等值，接线是零像素变更）；`--leading-*` **暂不接入**，见下方 ⚠️ | `tailwind.config.js`、`styles/tokens.css` |
| B0.7 | 主题改为首屏生效（现在只在 `Settings.tsx` 应用，非 Settings 路由刷新会丢暗色） | `src/frontend/index.html` 内联脚本 |

**B0 验收**：`bun run typecheck` 通过；`bun run lint` 干净；桌面/移动各 3 页截图对比无位置回归。

**B0 实测结论（1996×996 + 隔离数据目录 + 真实 Chromium）**：

| 项 | 结果 |
|---|---|
| 壳层几何 | header 48 / aside 256 / main 1740×948 —— 与改动前截图逐像素同构，**零回归** |
| 暗色首屏（B0.7） | 刷新后 `html.dark` 首帧即生效，`body` = `rgb(26,26,26)`；改前此处会白闪 |
| 文档滚动（B0.2） | 改后 `docOverflowPx = 0`（996/600/400/300 四档）；**还原 `min-h-screen` 后溢出 476px 且 `canScrollDoc = true`** → 改前顶栏会随文档滚走 |
| 文件树 gutter（B0.4） | computed `scrollbar-gutter: stable`、`overscroll-behavior: contain` 生效 |
| 令牌接线（B0.6） | 构建产物中 `.p-4{padding:var(--space-4)}`、`.text-sm{font-size:var(--text-sm)}`；未覆盖刻度仍走默认（`.py-0\.5`、`.gap-1\.5`、`.p-0` 均正常） |
| z-index（B0.1） | 5 个 `z-[var(--z-*)]` 类全部生成，`:root` 令牌齐全 |
| 死动画类（B0.5） | 全项目 `animate-in` / `fade-in-0` / `zoom-in-95` / `slide-in-from-*` 已清零 |
| `min-h-0`（B0.3） | **A/B 反证：移除后行为完全一致 → 冗余，非修复**，详见 P0-3 撤回说明 |

> ⚠️ **`--leading-*` 未接入，需要你决策**
>
> 实测结果：`--space-*`（9 个）与 `--text-*`（7 个）和 Tailwind 默认刻度**逐个等值**，接入 `theme.extend` 是零像素变更，已在 B0.6 接上，让 `tokens.css` 名副其实。
>
> 但 `--leading-*` **不等值**，接入会全局改行高：
>
> | 令牌 | tokens.css 值 | Tailwind 默认 | 差异 | 使用处 |
> |---|---|---|---|---|
> | `--leading-tight` | `1.4` | `1.25` | **+12%** | `globals.css:30,33,36,39,42,45` —— markdown 预览的 h1–h6 全部 |
> | `--leading-relaxed` | `1.75` | `1.625` | **+7.7%** | `globals.css:26,48,57`（正文）、`EmptyState.tsx:30`、`Editor.tsx:402`（编辑器 textarea） |
> | `--leading-normal` | `1.6` | `1.5` | +6.7% | 无引用 |
>
> 这三个 CSS 变量目前**零 `var()` 引用** —— 实际生效的是 Tailwind 默认值，而 `tokens.css:2` 的文件头却宣称 "every color/size/spacing traces to a token here"。
>
> B0 的契约是「不改视觉」，所以我**没有**顺手接上。三个选项请你选：
>
> - **(a) 保持现状** —— 不动，继续靠 Tailwind 默认；把 `--leading-*` 三个变量删掉，并在 `tokens.css:2` 去掉 "size/spacing" 的措辞。改动最小，但 markdown 行高维持 Tailwind 值。
> - **(b) 接入令牌** —— 行高按 `tokens.css` 的设计意图生效（`1.75` 正是注释里写的 "reading content"）。这是**有意的可读性改动**，但会改变所有 markdown 标题与正文的观感，需要你确认后再做，且应单独一批、单独截图评审。
> - **(c) 折中** —— 只接 `--leading-relaxed`（正文，1.75 对阅读友好），`--leading-tight` 保留 Tailwind 的 1.25（标题要紧凑）。改动局部，但仍需截图确认。
>
> 我倾向 **(b)**：令牌已经写好了且标了用途，接线才是兑现承诺；但它必须是一次显式的视觉变更，不能藏在「地基修复」批次里蒙混过关。

### B1 · 新增 4 个 primitive

| # | 任务 | 产出 |
|---|---|---|
| B1.1 | `ui/ScrollArea.tsx`：`min-h-0` + gutter + overscroll + 可选 sticky first slot | 收敛 13 处重复 |
| B1.2 | `ui/Breadcrumb.tsx`：`nav > ol`，末项 `aria-current="page"`，中间可点，溢出 `line-clamp` | 替换 `Editor.tsx:272-277`、`Dashboard.tsx:249-276` |
| B1.3 | `ui/DropdownMenu.tsx`：原生 `<dialog>`/popover + Escape + 焦点归还 + click-outside | 替换 `TopBar.tsx:43-67,138-172`；并作为 B3.2 `UserMenu` 与 B2.6 `LibrarySwitcher` 的底座 |
| B1.4 | `ui/Resizable.tsx`：grid + `role="separator"` 手柄 + 键盘调节（`←/→`）+ 双击复位，宽度写入 CSS 变量 | 为 B2 左栏折叠/调宽、B3 右栏做准备 |

**B1 验收**：每个组件补 1 个单测；`Dialog` 的 `role="dialog"` / `aria-modal` / 焦点行为不得回归。

> **B1.3 实现决策：popover 降级为「渐进增强」而非唯一路径**
>
> 原计划写的是"原生 `<dialog>`/popover"。动手前先探测了本项目的测试环境，发现 `tests/setup.ts` **手工构造并替换全局 jsdom**，该实例**不支持 Popover API**：
>
> ```
> HTMLElement.showPopover: undefined   popover 属性: 不存在
> setPointerCapture: undefined         ResizeObserver: undefined
> PointerEvent: 已定义                 matchMedia: undefined
> ```
>
> 若把 popover 作为**唯一**路径，`DropdownMenu` 在本项目里将完全无法单元测试；`Resizable` 若依赖 `setPointerCapture` 同样如此。
>
> 结论与做法：
> - **`DropdownMenu`** —— 定位、关闭、键盘**单一代码路径**（JS 计算 `position: fixed` 坐标 + 手写 outside-mousedown / Escape / focusin / Tab 环绕）。检测到 `showPopover` 时**额外**加 `popover="auto"` 并调用 `showPopover()`，从而拿到 top layer、原生 Escape、原生 light-dismiss，以及不被 `overflow` 祖先裁剪的收益；检测不到就走同一条手写路径。**jsdom 走的是降级路径，因此测试覆盖的正是生产环境共用的那段逻辑。**
> - **`Resizable`** —— 明确禁用 `setPointerCapture`，改用 `pointerdown` 时在 `window` 上挂 `pointermove`/`pointerup`、结束时卸载。这在 jsdom 可测，对鼠标/触摸/触控笔也更稳。
>
> Popover API 自 2025-01-27 起 Baseline widely available（Chrome 116 / Safari 17 / Firefox 125），现代浏览器都会走增强路径；手写路径不是为旧浏览器兜底，而是**让组件可测**。若将来想彻底删掉手写分支，等 `tests/setup.ts` 换成支持 popover 的 jsdom 即可 —— 届时删掉 `SUPPORTS_POPOVER` 相关三处判断，行为不变。

**B1 实测（真实 Chromium，临时 harness 挂载三个 primitive，已删除）**

真实浏览器能力探测：

```
showPopover: "function"   popover 属性: true   :popover-open: true
anchor-name: true         setPointerCapture: "function"      height: 100dvh: true
```

→ 生产环境**确实走 popover 增强路径**（`menu.matches(':popover-open') === true`，`z-index` 解析为 `25` = `--z-dropdown`），确认 jsdom 是异常环境。

> 🐛 **真实浏览器发现两个 jsdom 测不到的 bug（已修）**
>
> **Bug 1 —— `[popover]` 的 UA 样式覆盖了计算出的坐标**
>
> 症状：菜单被渲染到视口右缘外。排查发现 inline `top: 293px` / `left: 1121px` **本身完全正确**（`trigger.bottom + 4`、`trigger.right - width`），但 `getBoundingClientRect()` 报 `y = 534`。差值 241px 恰好等于垂直 inset 带（293→1000）的居中结果：`646.5 − 112.5 = 534`。
>
> 根因：UA 样式表给 `[popover]` 设了 **`inset: 0` + `margin: auto`**（配套 `width/height: fit-content`）。我写的 `top`/`left` 只是 inset 四条边中的两条，`right: 0` / `bottom: 0` 仍在生效，`margin: auto` 于是把面板在剩余带里**重新居中**。改 `position: absolute` 结果不变，反证了包含块被 UA 的 inset 重定义。
>
> 修复：菜单 className 加 `m-0 p-0 inset-auto` 三项重置，并在注释里写明"load-bearing，勿删"。
>
> **Bug 2 —— 量测时机早于 `showPopover()`**
>
> 症状：初始 `open=true` 时菜单贴右缘。
>
> 根因：popover 元素在 `showPopover()` 之前是 `display: none`，`getBoundingClientRect()` 返回 **0×0**。原实现在 `useLayoutEffect` 里量测、在 `useEffect` 里 `showPopover()`，于是 `align="end"` 算出 `rect.right - 0`，并被 clamp 到屏幕边缘；之后依赖未变，`measure()` 不再重跑，错误位置固化。
>
> 修复：`showPopover()` 与 `measure()` 放进**同一个 `useLayoutEffect`**，且 `measure()` 排在 `showPopover()` **之后**。两个 effect 都在 paint 前完成，不会闪一帧错位。
>
> **为什么单测没抓到**：jsdom 无 popover → 元素从不 `display:none` → 量得到真实尺寸，且无 UA popover 样式。测试路径与生产路径分叉，只有真浏览器能发现。这条也说明 B1 的验收不能只看 `bun run test`。

### B2 · 左栏重构（收益最大）

| # | 任务 | 解决 |
|---|---|---|
| B2.1 | 抽 `navConfig.tsx`，建 `WORKSPACE_NAV()` + `SETTINGS_GROUPS` 两个 registry；删除 3 份硬编码清单 | P1-6 |
| B2.2 | **左栏只渲染 `WORKSPACE_NAV()`**；`Settings`/`Diagnostics`/`Users`/`Audit Log`/`MCP Tokens` 从 `LeftSidebar.tsx:172-189` 删除 | P0-2、P1-6 |
| B2.3 | **删除 `Library` 导航项**（`LeftSidebar.tsx:174-176`，指向欢迎草稿、与下方文件树冗余）；Files 区块头部承担 `/editor/*` 的 active 指示（左侧 2px 指示条 + `aria-current="page"`） | P1-6 |
| B2.4 | 导航选中态加 `inset-inline-start` 2px 指示条（当前只有 `bg-primary/10`，长列表里 active 会"丢失"） | P2-13 |
| B2.5 | 导航区改 `flex: 0 0 auto` 不滚；文件区 `flex: 1` + `min-h-0` 独立滚 —— **这是 P0-3a 的真修复**（实测矮视口下文件树只剩 16px） | P0-3 a |
| B2.6 | 抽 `components/library/LibrarySwitcher.tsx` 放左栏顶部；移除 `TopBar.tsx:109-184` | P0-1、P1-9 |
| B2.7 | 抽 `components/file-tree/TreeView.tsx` + `TreeNodeItem.tsx`：补 `role="tree"` / `role="group"` / roving `tabIndex` + `↑↓←→ Home End` 键 + `aria-activedescendant` | P2-17（当前**键盘不可达**） |
| B2.8 | 选中项 `scrollIntoView({ block: 'nearest' })`；`expanded` 按库持久化并自动补齐祖先链 | P0-3 d |
| B2.9 | 文件树补 `loading` / `error` / `empty` 三态区分（当前请求失败也显示 "No files in this library"，`LeftSidebar.tsx:73-74,229-230`）；空态改用 `ui/EmptyState` | 可用性 |
| B2.10 | 文件树变更后刷新（依赖数组目前只有 `library?.id`，`LeftSidebar.tsx:82`）；顺手把裸 axios 迁到已有的 `@tanstack/react-query` | P0-4 |

**B2 验收**：

1. 深链 `/editor/:id/a/b.md` 打开 → 树自动展开到 `a/b.md` 并滚入视口。
2. 从搜索结果打开**另一库**的文件 → 树切到该库且 **Files 区块头部**显示 active。
3. 后退 / 前进 → 树高亮同步。
4. 键盘 `↓↑` 可遍历文件树。
5. 断网 → 显示错误态而非 "No files"。
6. 左栏**只剩 6 项**（或 5 项，若 MCP 也移出），且不含任何设置类项目。

> **B2 实施说明：与 B3.2 合并交付**
>
> B2 移除左栏的 Settings 行，而替代入口（顶栏身份菜单）属于 B3.2。**单独交付 B2 会让 Settings 变得无处可达**，两者耦合。B2.2 因此把 `UserMenu` 一并实现，`SETTINGS_MENU_GROUPS`（个人 / 系统分组 + `?tab=` 深链）也提前落地。
>
> 批次编号保持 B3.2 不变，只是实际执行时前移；`SETTINGS_MENU_GROUPS` 里 `?tab=` 深链依赖 B3.4 的 `?tab=` 路由状态落地才生效，**当前指向 `/settings?tab=x` 会被 Settings 页忽略（回落到第一个章节）**，需 B3.4 补齐 `useSearchParams` 后才真正可用。

**B2 实测（真实 Chromium + 隔离数据目录 + 双库 + 3 层深目录树）**

| 验收项 | 实测结果 |
|---|---|
| 左栏导航项 | `["Dashboard","Search","Notifications","Tasks","AI Assistant"]` —— 5 项，无任何设置类，无 Library |
| 顶栏库切换器 | 已移除；左栏顶部出现可点切换器（单库时 `aria-label="Library: memo"`，多库 `Switch library`） |
| 深链展开 | `/editor/:id/Blog/2026/q3/deep.md` → 三级祖先 `Blog=true / Blog/2026=true / Blog/2026/q3=true`，选中项在视口内 |
| 跨库跳转 | 跳到第二个库 → 树整体换成该库文件（`notes`/`top.md`），选中正确，切换器变多库形态 |
| 后退 / 前进 | 点击 → 选中；后退到 `/` → 选中清空；前进 → 恢复。**高亮完全跟随路由** |
| 键盘遍历 | `[tabindex="0"]` 数量 = **1**（单一 Tab 停靠点）；`↓↓↓↑` 顺序正确；`End`→末项；`Home`→首项；`←` 从 `deep.md` 回父目录 `Blog/2026/q3` |
| 断网 | 显示 `Could not load files / Network Error / Retry`，**不再是 "No files"**；点 Retry 确实重新发起请求 |
| P0-3a 修复 | nav 恒定 189px 不滚动，树拿全部剩余空间：h=600 → 树 270px（修复前 103px）、h=400 → 树 70px（修复前 **16px**） |
| 矮视口安全阀 | h=300 时 nav 让位并滚动，树从 16px 回到 46px（`max-h-[45%]`） |
| 导航清单单一化 | 三份硬编码字面量全部删除；`MobileDrawer` 由此**首次获得 active 态**（此前用 `<Link>` 一直没有） |

> 🐛 **真实浏览器又抓到一个 B1 遗留 bug（已修）：`DropdownMenu` 的 `align="end"` 在面板出现滚动条时错位 69px**
>
> 症状：UserMenu 右缘 483 vs 触发器右缘 552。
>
> 根因：`measure()` 用 `left = trigger.right - panel.width` 做对齐，而**在 `showPopover()` 之后同一 tick 内读到的面板宽度是陈旧的**（读到 208px，实际渲染 139px，差值恰好是 12px 滚动条 + 内容收缩）。B1 修的是"量测时机早于 showPopover"，但没解决"量到的是陈旧值"。
>
> 修复：**水平定位彻底不再依赖测量面板自身**。`align="end"` 改为写 `right = window.innerWidth - trigger.right`，由浏览器负责把右缘贴到触发器右缘；`align="start"` 仍写 `left = trigger.left`。面板高度只用于判断翻转和底部 clamp —— 高度读错只影响是否翻转，不会错位。
>
> 顺带发现并修掉一个自查失误：改 `Position` 接口时忘了同步 style 绑定，导致 `right` 从未写入样式（`inlineRight: ""`）。真浏览器复测才暴露。
>
> **注意**：这个 bug 在 jsdom 里**测不出来**（无 popover、无滚动条、面板始终可测量），单测全绿。

### B3 · 顶栏、用户菜单与设置子页面

| # | 任务 | 解决 |
|---|---|---|
| B3.1 | 顶栏改两段式：左 ☰+Logo+`Breadcrumb`，右 ⌘K 搜索 + 通知 + 新建 + **主题快速切换** + **可见身份块**（头像+用户名+角色） | P0-1、P1-5 |
| B3.2 | 新建 `UserMenu`（基于 B1.3 `DropdownMenu`）：身份区 + 切换账号 + 外观快速切换 + 设置子项（可深链 `?tab=`）+ 「系统」分组（诊断/用户/审计）+ 登出 | P0-2、P1-5 |
| B3.3 | **删除 `TopBar.tsx:238-244` 的设置图标**（与新用户菜单重复）；`231` 新建笔记保留但换图标（不再与 Logo 同图标 `104`） | P1-5、P1-6 |
| B3.4 | `Settings.tsx` 章节导航扩为 7 项并加「个人 / 系统」分组；`activeTab` 从 `useState`（`40`）改为 `?tab=` 派生 + 写回 URL | P0-2 |
| B3.5 | `Diagnostics` / `Users` / `Audit` / `MCP` 的内容迁入 `/settings` 对应章节（保留原路由做重定向，避免旧链接 404）；`advanced`（含删库）标 `dangerous`，**不进用户菜单与命令面板** | P0-2 |
| B3.6 | 搜索框改 `⌘K` 命令面板触发器（接 B3.8） | P0-1、P2-16 |
| B3.7 | `PageHeader` → `PageContextBar`：面包屑可点、路径**可复制**、右侧**只保留 1 个 primary** | P1-7、P1-8 |
| B3.8 | 接 `cmdk`（**依赖已在 `package.json`**）做 ⌘K：导航跳转、切换库、打开文件、新建笔记、设置跳转（排除 `dangerous`） | P2-16 |
| B3.9 | `Dashboard.tsx:159-186`：空态 CTA 降级为 `secondary`；并按"库为空 / 库有文件但未打开"分两种空态 | P1-7 |
| B3.10 | 内容区加 `max-inline-size: var(--content-max-w)` 居中；编辑器用 `--editor-max-w` | P2-10 |
| B3.11 | Editor 自绘头（`262`）改用 `PageContextBar`；把 3 条 `border-b` 横条（`TopBar:92` + `Editor:262` + `Editor:306`）合并为 1 条 | P2-12 |

**B3 验收**：

1. 1996px 下顶栏不再出现"看起来像标题"的居中控件。
2. 左栏与顶栏**都不出现** Settings / Diagnostics / Users / Audit Log；这四项只在用户菜单里。
3. 用户菜单里点「外观」直接落到 `/settings?tab=appearance` 的具体章节，刷新后停留原章节。
4. 普通用户不用鼠标也能找到外观设置：主题按钮在顶栏**可见可点**，不是藏在菜单里。
5. 全局搜索范围在触发器上有明确文案（当前库 / 全部库）。
6. 任意页面同屏只有 1 个 primary 按钮。
7. `/diagnostics`、`/users`、`/audit` 旧 URL 重定向到 `/settings?tab=...`，不出现 404。

**B3 实测（真实 Chromium + 隔离数据目录）**

| 验收项 | 实测结果 |
|---|---|
| 顶栏两段式 | 子节点分组 `[☰] [Web Note] [面包屑] [⌘K 搜索 + 通知 + 新建 + 身份块]`；`hasLibraryChip: false` —— 那个"伪居中的 memo chip"已消失 |
| ⌘K 命令面板 | `⌘K`/`Ctrl+K` 打开，5 组（导航 / 操作 / 切换库 / 设置·个人 / 设置·系统）共 **15 项**；输入「审计」精确命中「审计日志」；Escape 后面板**从 DOM 卸载** |
| `?tab=` 深链 | `/settings?tab=appearance` → 命中「外观」章节；**刷新后仍停留该章节**（URL + 选中态都保持） |
| 章节分组 | 分组标题 `["个人","系统"]`；tabs `["账号","安全","外观","诊断","MCP Tokens","用户","审计日志"]` |
| 旧路由重定向 | `/diagnostics`→`/settings?tab=diagnostics`、`/users`→`?tab=users`、`/audit`→`?tab=audit`、`/mcp`→`?tab=mcp`，**全部 replace 重定向，无 404** |
| 4 个迁入 section | 诊断（4 张 StatCard + Git/AI/Backups/Migrations）、MCP（空态 + 说明）、用户（admin 列表 + 会话）、审计（筛选 + 日志列表）均正常渲染 |
| 阅读宽度（B3.10） | 内容被限制到 **768px**（`--content-max-w`），居中于 1344px 主区 |
| 页头与正文对齐 | 标题 `x=544` / 正文容器 `x=544`，宽均 768 → `aligned: true`（见下方修复说明） |
| `dangerous` 隔离 | `advanced`（含删库）**不进**用户菜单与命令面板，仅靠 URL 与章节导航可达 |

> 🐛 **真浏览器抓到 4 个问题（全部已修）**
>
> **1. `CommandPalette` 常驻 DOM 拦截全站点击（严重）**
> cmdk 的 `Command` 自带遮罩且始终挂载，关闭时只是不显示内容 —— 于是整个应用**所有点击都被一层 `fixed inset-0` 挡住**，setup 流程完全走不下去。修法：`open === false` 时 `return null` 整体卸载。
>
> **2. 无库时文件树永久转圈**
> `useFileTree` 用了 `query.isPending`，而 react-query 对**被禁用**的查询（`enabled: false`）它永远为 `true`。改用 `isLoading`（v5 中等于 `isPending && isFetching`）。
>
> **3. `PageContextBar` 与正文宽度脱节**（由 B3.10 引入）
> 正文被限制到 768px 居中后，全宽页头仍把标题放在 x=272（1344px 主区最左），标题与它下面的内容对不上。修法：横条保持全宽（分隔线完整），**内部行与正文同宽居中**。
>
> **4. `?tab=` 深链指向 admin-only 章节时空白**
> `/users` 对所有人重定向到 `?tab=users`，但内容渲染才被 `isAdmin` gate —— 非 admin 会看到空面板。修法：`activeTab` 对非 admin 的 admin-only tab 回落到 `account`。
>
> **自查失误两处**：改 `DropdownMenu.Position` 接口时忘了同步 style 绑定（`right` 从未写入）；给 `Settings` 插 `ContentShell` 时用脚本算闭合标签算错层级导致 JSX 破损 —— 两次都是靠重新读文件 + 真实浏览器复测发现的。**用脚本批量改 JSX 结构不安全，应优先用编辑工具做精确替换。**
>
> **B3.11 现状（部分完成，如实记录）**：Editor 的 3 条横条已合并为 2 条（页头 + 工具条），内联面包屑已换成 `Breadcrumb` 组件；但**没有**改用 `PageContextBar` —— Editor 的头部职责明显不同（返回按钮 + 路径输入框 + 保存状态 + 视图切换 + Save），强行套用会扭曲其中之一。保留其自绘头是有意的取舍，不是遗漏。

### B4 · 密度、响应式、无障碍

| # | 任务 | 解决 |
|---|---|---|
| B4.1 | 左栏折叠为 56px rail（激活 `--sidebar-w-collapsed`）+ 拖拽调宽（`Resizable`） | P2-11 |
| B4.2 | 右栏（AI / 大纲 / 反链）接入 grid 第三轨，按页面显隐（激活 `--right-sidebar-w`） | 项目定位（AI-native）+ P2-10 |
| B4.3 | Editor split 视图改用 `Resizable`，默认 50/50 但可拖拽（现 `Editor.tsx:376` 固定） | P2-12 |
| B4.4 | 加 skip link（`跳到主内容` → `<main id="main" tabIndex={-1}>`） | P2-17 |
| B4.5 | 路由切换把焦点移到 `<h1>`/`PageContextBar`，并用 `aria-live` 播报页面名 | P2-17 |
| B4.6 | 三个 `<nav aria-label="Primary">` 改为 `主导航` / `移动主导航` / `移动快捷`；抽屉补焦点陷阱 + body 滚动锁 + 焦点归还 | P2-17 |
| B4.7 | 统一图标尺寸（控件 20px / 列表 16px）；文件树选中时图标同步变色 | P2-13 |
| B4.8 | 移动端（`<768px`）抽屉导航 = 左栏 6 项 + 末尾「⚙ 设置」入口（保证可发现，见 §3.1 第 6 条）；底栏收敛为 4 项 | 响应式 |
| B4.9 | 主题按钮加 `aria-pressed` / `aria-label`（当前主题只在 Settings 内可变，顶栏无从得知状态） | P2-17 |

**B4 验收**：1280 / 1440 / 1920 / 390 四档视口截图；键盘-only 走完"建笔记 → 保存 → 搜索 → 切库 → 改主题"全流程。

---

## 7. 回归约束（不得破坏）

来自前序文档与现有测试，改动必须同时满足：

**E2E 文案锚点**（`tests/e2e/auth.spec.ts`）：

`Create Library`、`New Library`、`New Note`、`Save`、
`input[placeholder="My Notes"]`、`input[placeholder="my-notes"]`、`Welcome to ${name}`

**单测锚点**（`tests/unit/left-sidebar.test.tsx` 等）：

- `LeftSidebar` 必须继续请求 `GET /files/:id/tree` 并渲染节点文本
- `textarea[aria-label="Markdown source"]`
- Save 按钮文本
- 登出 `aria-label="Log out"`

> ✅ 已核查：`tests/` 里**没有任何断言**导航文案或 `aria-label="Primary"` 的用例（`grep` 全 `tests/` 仅命中 `LeftSidebar` 的文件树测试）。因此 B2.2（移出 Settings 等 5 项）与 B2.3（删除 Library 项）**不破坏现有测试**。若后续有人补了导航文案断言，需同步更新（改测试优于回退设计）。

**路由兼容约束**（B3.5 引入）：`/diagnostics`、`/users`、`/audit`、`/mcp` 的旧 URL 必须**重定向**到 `/settings?tab=...`，不得 404。这些页面可能被用户收藏或写在笔记里，也可能被前序文档提到的外部链接引用。

**设计令牌契约**（`DESIGN.md:197-210`）：`--topbar-h: 3rem`、`--sidebar-w: 16rem`、`--mobile-drawer-w: 18rem`、`--bottom-nav-h: 3.5rem` 的**值不得改动**；本方案只新增 `--shell-h` / `--z-*`，并**激活**（而非修改）`--content-max-w` / `--editor-max-w` / `--sidebar-w-collapsed` / `--right-sidebar-w`。导航区宽度沿用 `--sidebar-w: 16rem`，线框中的 256px 即此值 —— 为 16px 去动令牌契约不值得。

**验证命令**：

```bash
bun run lint          # biome check .
bun run typecheck     # tsc --noEmit
bun run test          # vitest run
bun run test:e2e      # playwright（需先起服务 + 隔离数据目录）
```

---

## 附录 A：死代码 / 空脚手架清单

改造时顺手清理或启用，不要留着继续误导：

| 位置 | 状态 | 处置 |
|---|---|---|
| `components/command-palette/` | 空目录；`cmdk@^1.0.0` 已在依赖里，零 import | **B3.8 启用** |
| `components/file-tree/` | 空目录；文件树内联在 `LeftSidebar.tsx` | ✅ **B2.7 已启用**（`TreeView` / `TreeNodeItem` / `useFileTree`） |
| `components/library/` | 空目录；库切换器内联在 `TopBar.tsx` | ✅ **B2.6 已启用**（`LibrarySwitcher`） |
| `components/{ai,confirm,diagnostics,git,search,settings,trash}/` | 均为空目录 | 确认是否还需要，否则删除 |
| `stores/` | 空目录；`zustand@^5.0.0` 零 import | B2 用 react-query + Context 已够，**不引入 zustand**；依赖待后续决策 |
| `tokens.css:71,72,75,76` | 4 个令牌定义后零引用 | **B0/B3 激活** |
| `tokens.css:25-39,42-50` | `--space-*` / `--text-*` 已于 B0.6 接入；`--leading-*` **未接入**（会改行高，见 B0 下方 ⚠️） | **B0.6**（待你决策） |
| `Layout.tsx:13` | `const location = useLocation()` 声明后未使用（死代码） | ✅ **B2 已清理** |
| `Layout.tsx:31` | 与 `useLibraries.tsx:49-56` 重复写 `localStorage.currentLibraryId` | 待 B3 处理（`handleLibraryChange` 收口） |
| `backend/modules/libraries/routes.ts:378-405` | `GET /libraries/:id/tree` 与 `GET /files/:id/tree` 重复，前端只用后者 | 后续清理 |
| `@tanstack/react-query` | 此前零 `useQuery`；文件树走裸 axios + `useEffect` | ✅ **B2.10 已接入**（`useFileTree`）—— 顺带让左栏测试需要 `QueryClientProvider` |
| `animate-in*` / `slide-in-from-*` | 无 `@keyframes`、无插件 → 死类 | **B0.5** |
| 主题应用时机 | `applyTheme` 仅 `Settings.tsx` 调用 | ✅ **B0.7 已修**（`index.html` 内联脚本，实测首帧生效） |

## 附录 B：十个空目录

`ai/`、`command-palette/`、`confirm/`、`diagnostics/`、`file-tree/`、`git/`、`library/`、`search/`、`settings/`、`trash/`

这批空目录说明"组件化"曾被规划但从未执行：文件树、库切换器、命令面板三块**本该独立**的逻辑至今内联在 `LeftSidebar.tsx`（237 行）和 `TopBar.tsx`（253 行）里 —— 这正是 P0-2 / P0-4 难以根治的结构原因。本方案 B1/B2 的拆分方向与原规划一致。