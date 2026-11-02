# 开发指南

需求见 [需求文档](requirements.md)，结构见 [架构设计](architecture.md)。编码约束见 [`AGENTS.md`](../AGENTS.md)。

## 1. 环境

- Node.js
- pnpm
- Rust（[rustup](https://www.rust-lang.org/tools/install)）
- macOS（v1 验收平台）

## 2. 命令

```bash
pnpm install
pnpm test           # 调度、轮询、查找的回归检查（模拟原生桥）
pnpm build          # TypeScript 检查与前端构建
pnpm tauri dev      # 桌面开发
pnpm tauri build    # 打包
```

不要用浏览器打开 `http://localhost:1420` 做功能验收：那里没有子 WebView，也没有 Tauri IPC。

开发以 `pnpm tauri dev` 拉起的那一个进程为准。直接 `open` 调试二进制可能再起一个实例。

本轮已加入的依赖（不要再改成 npm / yarn）：

```bash
pnpm add @tauri-apps/plugin-opener @tauri-apps/plugin-clipboard-manager @tauri-apps/plugin-dialog
pnpm add -D @iconify-json/lucide
```

Rust 侧见 `src-tauri/Cargo.toml`：`tauri-plugin-opener`、`tauri-plugin-clipboard-manager`、`tauri-plugin-dialog`、`tauri-plugin-window-state`。

## 2.2 命令与快捷键

Rust 命令（仅 `main` WebView 可调）：

| 命令 | 作用 |
| --- | --- |
| `create_content_webview` | 创建 `wv-*` 子 WebView |
| `navigate_content_webview` | `back` / `forward` / `reload` / `stop` |
| `load_content_webview` | 导航到 URL |
| `content_webview_history` | 读标题、URL、前进后退 |
| `close_content_webview` | 销毁子 WebView |
| `set_content_zoom` | `webview.set_zoom` |
| `popup_menu` | 原生弹出菜单；需传窗口坐标。选中项经 `menu-action` 回传，命令会短等事件循环写完再返回 |

快捷键走应用菜单加速键，焦点在第三方网页内仍然有效：

| 快捷键 | 动作 |
| --- | --- |
| ⌘, | 设置 |
| ⌘B | 收起 / 展开侧栏 |
| ⌘1–9 | 切换到侧栏第 n 个服务 |
| ⌘D | 向右分屏 |
| ⌘⇧M | 管理服务 |
| ⌘[ / ⌘] | 后退 / 前进 |
| ⌘R / ⌘. | 刷新 / 停止 |
| ⌘W | 关闭当前可关闭标签 |
| ⌘= / ⌘- / ⌘0 | 放大 / 缩小 / 实际大小 |
| ⌘⇧C / ⌘⇧O | 复制链接 / 在系统浏览器打开 |

## 2.1 GitHub Actions 发布

推送到 `master`（或手动跑 `Release` workflow）会：

1. 打 tag `build-{run 序号}` 并创建 GitHub Release
2. 编译 macOS Apple Silicon、macOS Intel、Windows x64 安装包，上传到该 Release

下载见仓库 [Releases](https://github.com/taopaox/ai-panel/releases)。macOS 包是 ad-hoc 签名、未公证；Windows 包未签名。仓库 Settings → Actions → Workflow permissions 需允许读写，否则无法创建 tag / Release。

本地验收仍以 `pnpm tauri dev` 的 Mac 窗口为准。

## 3. 新增内置服务

在 [`src/types.ts`](../src/types.ts) 的 `CATALOG_SERVICES` 增加一项，并把图标 SVG 放到 [`src/assets/icons/`](../src/assets/icons/)（`logo` 与文件名一致，不含扩展名）：

- `id`：小写字母和 `-`，不要数字
- `builtin: true`
- `url`：https 入口
- `logo`：Cherry Studio 小程序同款图标 id
- `color`：无图标时的字头底色

若要启动后就出现在侧栏，把 `id` 写入 `DEFAULT_ENABLED_IDS`。然后 `pnpm tauri dev`，在管理页或侧栏点进该服务确认能打开、能登录。

## 4. 本地数据

| 用途 | 路径 |
| --- | --- |
| 服务列表、上次选中、分屏栏、侧栏启用的内置 ID、固定分屏菜单、锁定、主题、侧栏折叠、排序、缩放 | `~/Library/Application Support/com.yxhc.aipanel/workspace.json` |
| 登录 Cookie | 系统 WebKit / `HTTPStorages` 下与 `ai-panel`、`com.yxhc.aipanel` 相关的项 |

只重置列表：删除 `workspace.json`。连登录一起清：还要清除该 App 的 WebKit 站点数据。

## 5. 验收

按 [需求文档 §8](requirements.md#8-验收标准) 在桌面窗口中过一遍：切换、登录持久、管理页加入/移出内置项、自定义添加/删除、窗口缩放、始终单窗口、标签栏、当前页后退/前进/刷新、分屏并排与拖动分隔条、固定分屏到侧栏、锁定后不能改网页、侧栏打开状态与关页释放内存、侧栏折叠、主题、快捷键、分屏选择器、拖动排序。

性能改动额外检查：先运行 `pnpm test` 覆盖快速输入取消旧查找、相同状态保持引用、轮询暂停 / 恢复、查询去重、重复布局不发 IPC、关页重开清缓存与慢速原生调用下的布局合并。查找脚本另验证跨行内节点匹配、切换匹配复用缓存、流式文本变化后失效及关闭时清理观察器。

随后在 `pnpm tauri dev` 桌面窗口中切换多个服务、拖动分隔条、进入 / 返回管理与设置页，检查原生内容页的显示及位置；用 ⌘F 连续输入并切换匹配，确认高亮和计数正确。模拟桥检查不能代替桌面验收，也不代表第三方网页实际内存或 CPU 的基准数据。

## 6. 已知限制

- 部分站点对 WebKit 不友好（验证码、语音、Chrome-only API）。v1 保证文字对话路径。
- 隐藏中的 WebView 可能被系统节流，切回后一般恢复。
- 侧栏关闭页面会销毁该服务全部内容 WebView 以释放内存，登录 Cookie 仍在；再打开会重新加载页面。
- 隐藏页保留页面内存状态，不自动回收；每服务最多 8 个标签，总内存仍取决于已打开网页的数量与内容。管理 / 设置页、窗口失焦或壳文档隐藏时暂停 History 补查轮询，返回时立即补查。
- `create_content_webview` 必须是 async 命令（Windows 上同步创建会 deadlock；Mac 同样按此实现）。
- Tauri 多 WebView 仍挂在 `unstable` feature 上。
- 前进/后退可用性来自页面 History / Navigation API。站点若用自己的应用内栈，可能和侧栏按钮不一致；无 Navigation API 时前进按钮可能一直不可用。
- `window.open` / `target=_blank` 会在当前服务下新开标签。依赖真实系统弹窗、`window.close` 或 `window.opener` 回传的流程可能不完整。额外标签不写入 `workspace.json`，退出后只保留各服务首页与分屏各栏的首页。
- 分屏最多 3 栏；同一服务不能同时出现在两栏。拖动分隔条依赖指针捕获，若系统把后续移动事件交给内容 WebView，松手后再拖一次即可。
- 固定分屏最多 12 个。列表按固定先后排列，可拖动改顺序；点选或锁定只更新该项内容，不把它挪到第一位。名称可改（双击 / 铅笔 / 右键），最多 40 字，写入 `workspace.json`；自定义名在改各栏网页时保留，留空回退到服务名组合。锁定只冻结该菜单里各栏对应哪个服务，不拦住离开：点其他服务进入该页面，再点分屏菜单回来。站点内对话、标签、前进后退仍可用。解锁后改各栏网页会写回当前这项分屏菜单。
- 侧栏服务与固定分屏的排序用指针拖动（移动超过约 8px 才算拖），不走 HTML5 DnD，避免 WebKit 窗口里拖不动。
- 快捷键走原生菜单，会拦截站点自己的 ⌘W / ⌘R 等。分屏选择器与右键菜单是系统菜单，不会被内容 WebView 盖住。调用时要带窗口坐标（`popup_menu_at`）；选中结果走事件循环，`popup_menu` 会在菜单关掉后再短等 `menu-action`，否则点了像没反应。
- `set_zoom` 对部分站点布局可能不完整；缩放按服务记忆。
- CI 会打 Windows / macOS 安装包，但 Windows 体验仍不打磨；macOS 包无 Apple 公证，下载后系统可能提示未验证开发者。
