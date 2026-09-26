# UI 功能与布局重构设计

> 状态：已实施（与代码同步验证：`bun run typecheck` 通过）。
> 目标：解决“布局按钮不合理、交互错乱、找不到功能按钮”——先把全部功能入口盘点清楚，再按统一规范归位。

## 1. 功能总览（路由 × 页面 × 入口）

| 路由 | 页面 | 主要按钮 / 入口 | 说明 |
|---|---|---|---|
| `/login` | `pages/Login.tsx` | Sign in、显隐密码、Remember me、`Run setup wizard → /setup` | 全屏无外壳 |
| `/setup` | `pages/Setup.tsx` | Create Admin Account | 全屏无外壳 |
| `/` | `pages/Dashboard.tsx` | Create Library / New Library（同弹窗）、New Note、Browse Files | 库为空时空态建库；有库时欢迎态 |
| `/editor/:libraryId`、`/editor/:libraryId/*` | `pages/Editor.tsx` | 返回 Dashboard、Note path 输入、Saved 状态点、Write/Preview/Split、Save、9 个 Markdown 格式按钮 | `*` 为笔记路径；无路径时为欢迎草稿 |
| `/settings` | `pages/Settings.tsx` | Account（只读）/ Security（改密 + 退出全部设备）/ Appearance（主题 + 字号）/ Advanced（导出配置、备份库、库删除） | 左侧竖 Tab，移动端横排 |
| `/diagnostics` | `pages/Diagnostics.tsx` | Refresh、Export（含导出弹窗）、只读 StatCard/Git/AI 卡 | 30s 轮询 |
| `*` | `App.tsx` 内联 `NotFound` | Back to dashboard | 兜底空白页修复 |

全局浮层：Add Library 弹窗（Dashboard）、Diagnostics Export 弹窗、库切换下拉（TopBar）、移动端抽屉（MobileDrawer）。

## 2. 布局规范（实施后现状）

```
┌──────────────── TopBar (48px) ────────────────┐
│ [☰mobile] [Logo→/] [库切换]  [新建][设置][登出] │
├────────┬─────────────────────────┤
│ 左栏   │ 主内容 <Outlet/>        │
│ 256px  │                         │
│ 导航区 │                         │
│ 文件树 │                         │
└────────┴─────────────────────────┘
移动端：左栏隐藏 → 汉堡抽屉；底栏 4 项（Home/Library/New/Settings）
```

- **导航矩阵（桌面 / 移动一致）**：Dashboard（Home）/ Library（Editor）/ Settings / Diagnostics 四项在左栏导航区与抽屉内一一对应，顺序一致；底栏为高频子集（Home、Library、New、Settings），Diagnostics 只进抽屉 + 左栏（不对普通用户在底栏喧宾夺主）。
- **按钮归位规则**：
  - 全局动作（新建笔记、设置、登出）只在 TopBar；
  - 库切换只有 TopBar 一处（抽屉内库列表为移动端镜像，样式行为一致）；
  - 文件操作（新建）挂在左栏 Files 区右上角；
  - 页面级动作（Refresh/Export/改密）留在各页 PageHeader / 表单内；
  - 危险动作（删库）只在 Settings → Advanced，二次确认。
- **文案诚实**：Dashboard 不再提不存在的“右栏 AI 助手”；`Browse Files` 与 `New Note` 不再是同一行为（前者进库浏览文件树，后者进编辑器并聚焦路径输入）。

## 3. 本次修复的问题 → 方案（可追溯）

| # | 问题 | 根因 | 方案 | 涉及文件 |
|---|---|---|---|---|
| 1 | 桌面端 ≥1024px 点不到 Settings/Diagnostics/Dashboard | BottomNav/Drawer 均为 `lg:hidden`，TopBar 无导航、左栏只有文件树 | TopBar 加 Logo + 设置入口；左栏顶部加四项主导航（NavLink 高亮） | TopBar、LeftSidebar |
| 2 | Dashboard `Browse Files` 与 `New Note` 同行为 | 共用 `handleNewNote` | 拆分：Browse→进库；New→进编辑器 + `state.newNote` 聚焦路径框；Editor 消费该 state | Dashboard、Editor |
| 3 | 文案指向已删除的右栏 AI 助手 | commit 29e73f3 删右栏后文案未改 | 改为空态引导看左栏文件树 | Dashboard |
| 4 | 移动端/桌面导航不一致（抽屉 3 项、底栏 4 项、桌面 0 项） | 三处各自为政 | 抽屉补 Library 入口；底栏改为 Home/Library/New/Settings；左栏导航与抽屉同序 | MobileDrawer、BottomNav、LeftSidebar |
| 5 | 未匹配路由白屏 | 无 catch-all | `*` → NotFound（Back to dashboard） | App |
| 6 | `update/deleteLibrary`、`logoutAll` 有 hook 无按钮 | 功能无入口 | Settings：Security 加“退出全部设备”；Advanced 加库列表 + 两步删除 | Settings |
| 7 | `isMobile` JS 断点与 `lg:` 双重控制 | Layout 监听 resize 再传 className | 纯 CSS 断点（`hidden lg:flex`），内容区加底栏避让 `pb-[bottom-nav] lg:pb-0` | Layout |
| 8 | Editor 无返回、丢上下文 | 只有路径框 + 保存 | 顶栏加返回按钮 + 面包屑（库名 / 路径 / New note） | Editor |

## 4. 有意不做的事（后端有、前端暂无入口）

全局搜索、tasks、notifications、webhooks、mcp、migration、audit、用户管理、AI chat/agent/conversations——后端已注册但前端零入口。本次不补（避免 scope 爆炸），待后续按相同规范逐个归位；`tokens.css` 中 `--right-sidebar-w` / `--sidebar-w-collapsed` 为已删除右栏/折叠的残留令牌，待右栏（AI）真正回归时再启用，不在此次删除以免与 DESIGN.md 脱节。

## 5. 回归约束（重构不得破坏）

- e2e 文案锚点保留：`Create Library`、`New Library`、`New Note`、`Save`、`input[placeholder="My Notes"/"my-notes"]`、`Welcome to ${name}`；
- 单元测试锚点保留：`LeftSidebar` 的 `/files/:id/tree` 请求与节点文本、`textarea[aria-label="Markdown source"]`、Save 按钮文本、登出 `aria-label="Log out"`；
- `DESIGN.md` tokens（48px 顶栏 / 256px 左栏 / 8px 圆角 / 主色单蓝）不改，只修布局装配。

## 6. 验证记录（真服务 + 真浏览器）

- `bun run lint` 干净；`vitest` 14/14 通过；`vite build` 成功；改动文件 `tsc` 零报错（剩余为既有后端报错）。
- 隔离数据目录起后端真服务（`:8080`），Playwright Chromium `tests/e2e/auth.spec.ts` 4/4 通过：setup 重定向、建库（Create/New Library）、New Note 进编辑器 + Save。
- 真浏览器截图目检：Dashboard（顶栏 Logo/库切换/新建/设置/登出、左栏四导航、空态）、欢迎态（New Note vs Browse Files 已分流、文案无 AI 侧栏）、Editor（返回 + 面包屑 + 路径框自动聚焦 + Saved + 视图切换 + 9 格式按钮 + 双栏）、Settings（左栏高亮正确）。
- 移动视口（390×844）目检：底栏恰为 Home/Library/New/Settings 四项（Diagnostics 已移出）、汉堡抽屉含库列表（当前高亮）+ Dashboard/Library/Settings/Diagnostics 同序导航；空态文案改为“sidebar menu”以同时覆盖桌面左栏与移动抽屉。
- 附带修复（会话鉴权，二层叠 bug，均已验证）：① `src/backend/modules/auth/routes.ts` 从未挂载 `authMiddleware`，`GET /me`、`POST /logout-all`、`POST /change-password`、`GET/DELETE /sessions*` 的 `c.get('userId')` 恒空——已给 5 个端点逐个挂载（`POST /logout` 故意保持开放以兼容过期会话退出；另给 `DELETE /sessions/:id` 补 `sessionId` 空守卫）。② `useAuth.fetchUser` 取 `response.data.user`，而 `/me` 直接返回用户对象——已改为 `?? response.data` 兼容。验证：登录→`/me` 200；`logout-all` 后旧 cookie `/me` 401；整页刷新停留在 `/settings`（此前必跳 `/login`）。
- 错误语义修复（已验证）：`errorHandler` 无视 `AppError.statusCode` 一律 500——已加 `AppError` 分支按自带码返回（`ContentfulStatusCode` 收窄；`POST /logout` 保持开放）。另给 `login`/`changePassword` 包 `withSuppressedAuthRedirect`（`services/api.ts` 新增，保存/恢复旧值），防止凭据错误 401 触发全局跳登录。验证：错密码登录→401 + 行内错误、无跳转；未鉴权 `/me`→401；改密错密码走到真实校验；新鲜隔离库 e2e 4/4；单测 14/14、`biome` 干净、改动文件类型报错与基线一致。
