# 架构设计

对应需求见 [需求文档](requirements.md)。

## 1. 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳 | Tauri 2，开启 `unstable`（同一窗口多 WebView） |
| 侧栏 UI | Vue 3 + TypeScript + Vite + UnoCSS |
| 包管理 | pnpm |
| 配置持久化 | `tauri-plugin-store` |
| 站点会话 | 系统 WebView 默认数据仓库（Mac 为 WKWebView） |

应用名 `AI Workspace`，bundle id `com.yxhc.aipanel`。

## 2. 关键约束

1. **禁止 iframe。** 目标站点普遍禁止被嵌入，右侧必须是原生子 WebView。
2. **Mac 内核是 WebKit，不是 Edge。** 不能读取 Edge Cookie；User-Agent 使用 Safari，不伪装 Chrome。
3. **多 WebView API 依赖 `tauri` feature `unstable`。** 去掉后 `Window::add_child` 无法编译。
4. **IPC 只给 `main`。** capabilities 使用 `"webviews": ["main"]`，禁止写成 `"windows": ["main"]`，否则 ChatGPT 等页面也能调 store / invoke。

## 3. 窗口与 WebView 模型

一个 `Window`（label `main`）内多个 WebView：

| WebView label | 内容 | 位置 |
| --- | --- | --- |
| `main` | Vue 壳：左侧栏 + 各栏标签栏 + 分隔条 | 铺满整个窗口 |
| `wv-{serviceId}` | 服务首页 | 所在分屏栏的内容区 |
| `wv-{serviceId}-t-{suffix}` | 该服务额外标签页 | 同上 |

分屏时同时 `show()` 各栏当前标签对应的 WebView，其余 `hide()`。未进入过的服务仍是首次点击（或分屏放入该栏）时才创建。已打开页保留内存状态，侧栏用绿点标出；可关闭以销毁 WebView 释放内存。同一服务不能同时出现在两栏。

```
App.vue（侧栏 + 管理页 / 各分屏栏标签栏 + 分隔条）
  └─ useWorkspace()
       ├─ persist.ts     → workspace.json
       ├─ layout.ts      → 各栏逻辑像素 bounds
       └─ invoke / 事件
            create_content_webview
            navigate_content_webview   # back | forward | reload
            load_content_webview
            content_webview_history
            close_content_webview
            listen content-page-state
            listen content-open-tab
```

内容 WebView 在 Rust 中创建：`WebviewBuilder` + `window.add_child`。`window.open` / `target=_blank` 的 http(s) 由 `on_new_window` 发给侧栏 `content-open-tab`，再创建额外标签；始终 `Deny` 系统新窗口。页面加载完成或标题变化时发送 `content-page-state`。

内容 WebView 的 label 规则：首页为 `wv-` + 服务 id；额外标签为 `wv-{id}-t-` + 字母后缀。Tauri label 不要包含数字；自定义 id 形如 `custom-abcdefghij`。

## 4. 数据

| 类别 | 存储 | 写入方 |
| --- | --- | --- |
| 自定义服务列表、侧栏启用的内置 ID、上次选中 ID、分屏各栏服务与宽度比例、固定分屏菜单、锁定 | `~/Library/Application Support/com.yxhc.aipanel/workspace.json` | `tauri-plugin-store` |
| Cookie、站点 localStorage | 系统 WebKit / HTTPStorages | WKWebView |

启动时：内置目录始终来自 `src/types.ts` 的 `CATALOG_SERVICES`；侧栏只显示 `enabledServiceIds` 中的内置项，再合并 store 里 `builtin: false` 的自定义项。这样内置 URL / 图标更新不会被旧缓存挡住。

侧栏宽度 `SIDEBAR_WIDTH = 240`，标签栏高度 `TAB_BAR_HEIGHT = 40`，分屏分隔条 `SPLITTER_WIDTH = 8`，最多 `MAX_PANES = 3`，固定分屏最多 `MAX_SAVED_LAYOUTS = 12`。布局计算与 `main` WebView 实际尺寸都使用它们，不是仅靠 CSS 裁切。各栏宽度按比例分配内容区（扣除分隔条），最小约 200px。打开管理页时内容 WebView 全部 `hide()`，管理页由 `main` 铺满侧栏右侧。固定分屏 id 形如 `layout-abcdefgh`，只出现在侧栏，不创建 WebView。

## 5. 权限

[`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json)：

- 仅 `webviews: ["main"]`
- 允许 store、拖拽窗口、子 WebView 的 show/hide/close/resize/focus

内容页 `wv-*` 不注入这些能力。

## 6. 文件职责

| 路径 | 职责 |
| --- | --- |
| [`src/types.ts`](../src/types.ts) | 服务模型、内置目录 `CATALOG_SERVICES`、默认侧栏 ID、分屏常量、固定分屏 `SavedLayout`、id / 标签 label 与 URL 规范化 |
| [`src/App.vue`](../src/App.vue) | 窗口壳：侧栏列表、打开状态与关页、固定分屏菜单、管理页入口、多栏标签栏与分隔条 |
| [`src/components/ServiceIcon.vue`](../src/components/ServiceIcon.vue) | 侧栏 / 管理网格的品牌图标或字头 |
| [`src/components/ServiceManager.vue`](../src/components/ServiceManager.vue) | 启动台式管理页：搜索、目录网格、自定义添加 / 编辑 |
| [`src/components/TabBar.vue`](../src/components/TabBar.vue) | 后退/前进/刷新、页面标签、锁定/分屏/关闭分屏 |
| [`src/composables/useWorkspace.ts`](../src/composables/useWorkspace.ts) | 服务、分屏栏、固定分屏菜单、锁定、标签状态、创建/切换/关闭 WebView、窗口缩放 |
| [`src/lib/icons.ts`](../src/lib/icons.ts) | `logo` id 到 `src/assets/icons` SVG 的映射 |
| [`src/lib/layout.ts`](../src/lib/layout.ts) | 侧栏、标签栏、分屏栏 bounds 与分隔条比例 |
| [`src/lib/persist.ts`](../src/lib/persist.ts) | store 读写与内置/自定义/分屏/固定菜单合并 |
| [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) | 子 WebView 生命周期、UA、新窗口改为开标签、前进/后退/刷新 |
| [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) | 窗口尺寸、Overlay 标题栏、macOS ad-hoc 签名 |
| [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) | `unstable`、store 依赖 |
| [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) | 侧栏 IPC 白名单 |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | 推送 `master` 后打 `build-N` tag，编译 Windows / macOS 安装包并发布 Release |

## 7. 扩展点

- 新增内置 AI：改 `CATALOG_SERVICES`，并把 SVG 放到 `src/assets/icons/`；若要默认出现在侧栏，加入 `DEFAULT_ENABLED_IDS`。
- 改侧栏宽度、标签栏高度、分屏栏数或分隔条：改 `SIDEBAR_WIDTH` / `TAB_BAR_HEIGHT` / `MAX_PANES` / `SPLITTER_WIDTH`（布局会跟着变）。
- 改新窗口策略：改 `lib.rs` 的 `on_new_window`。
