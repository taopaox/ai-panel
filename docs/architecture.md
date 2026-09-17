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
| `main` | Vue 壳：左侧栏 + 右侧顶部标签栏 | 铺满整个窗口 |
| `wv-{serviceId}` | 服务首页 | `(240, 40)`，宽高为窗口剩余区域 |
| `wv-{serviceId}-t-{suffix}` | 该服务额外标签页 | 同上 |

同一时刻只 `show()` 一个内容 WebView，其余 `hide()`。首次点击某服务才创建对应 WebView，避免启动时加载全部站点，并保留已打开页的内存状态。

```
App.vue（侧栏 + 标签栏）
  └─ useWorkspace()
       ├─ persist.ts     → workspace.json
       ├─ layout.ts      → 逻辑像素 bounds
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
| 自定义服务列表、上次选中 ID | `~/Library/Application Support/com.yxhc.aipanel/workspace.json` | `tauri-plugin-store` |
| Cookie、站点 localStorage | 系统 WebKit / HTTPStorages | WKWebView |

启动时：内置服务始终来自 `src/types.ts` 的 `DEFAULT_SERVICES`；store 中只合并 `builtin: false` 的项。这样内置 URL 更新不会被旧缓存挡住。

侧栏宽度常量 `SIDEBAR_WIDTH = 240`，标签栏高度 `TAB_BAR_HEIGHT = 40`。布局计算与 `main` WebView 实际尺寸都使用它们，不是仅靠 CSS 裁切。

## 5. 权限

[`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json)：

- 仅 `webviews: ["main"]`
- 允许 store、拖拽窗口、子 WebView 的 show/hide/close/resize/focus

内容页 `wv-*` 不注入这些能力。

## 6. 文件职责

| 路径 | 职责 |
| --- | --- |
| [`src/types.ts`](../src/types.ts) | 服务模型、内置列表、id / 标签 label 与 URL 规范化 |
| [`src/App.vue`](../src/App.vue) | 窗口壳：侧栏列表、添加表单、右侧标签栏 |
| [`src/components/TabBar.vue`](../src/components/TabBar.vue) | 后退/前进/刷新与页面标签 |
| [`src/composables/useWorkspace.ts`](../src/composables/useWorkspace.ts) | 服务与标签状态、创建/切换 WebView、窗口缩放 |
| [`src/lib/layout.ts`](../src/lib/layout.ts) | 侧栏、标签栏与内容区逻辑像素 |
| [`src/lib/persist.ts`](../src/lib/persist.ts) | store 读写与内置/自定义合并 |
| [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) | 子 WebView 生命周期、UA、新窗口改为开标签、前进/后退/刷新 |
| [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) | 窗口尺寸、Overlay 标题栏 |
| [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) | `unstable`、store 依赖 |
| [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) | 侧栏 IPC 白名单 |

## 7. 扩展点

- 新增内置 AI：改 `DEFAULT_SERVICES`。
- 改侧栏宽度或标签栏高度：改 `SIDEBAR_WIDTH` / `TAB_BAR_HEIGHT`（布局会跟着变）。
- 改新窗口策略：改 `lib.rs` 的 `on_new_window`。
