# 架构设计

对应需求见 [需求文档](requirements.md)。

## 1. 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳 | Tauri 2，开启 `unstable`（同一窗口多 WebView） |
| 侧栏 UI | Vue 3 + TypeScript + Vite + UnoCSS |
| 包管理 | pnpm |
| 配置持久化 | `tauri-plugin-store` |
| 窗口状态 | `tauri-plugin-window-state` |
| 外链 / 剪贴板 / 确认框 | opener、clipboard-manager、dialog |
| 站点会话 | 系统 WebView 默认数据仓库（Mac 为 WKWebView） |

应用名 `AiPanel`，bundle id `com.yxhc.aipanel`。

## 2. 关键约束

1. **禁止 iframe。** 目标站点普遍禁止被嵌入，右侧必须是原生子 WebView。
2. **Mac 内核是 WebKit，不是 Edge。** 不能读取 Edge Cookie；User-Agent 使用 Safari，不伪装 Chrome。
3. **多 WebView API 依赖 `tauri` feature `unstable`。** 去掉后 `Window::add_child` 无法编译。
4. **IPC 只给 `main`。** capabilities 使用 `"webviews": ["main"]`，禁止写成 `"windows": ["main"]`，否则 ChatGPT 等页面也能调 store / invoke。
5. **浮层菜单用原生 popup。** 右键、分屏选择器、标签更多菜单走 `popup_menu`，禁止用 DOM 弹层盖网页。
6. **壳子颜色只用 `--c-*` token。** 不要在组件里写死 hex。

## 3. 窗口与 WebView 模型

一个 `Window`（label `main`）内多个 WebView：

| WebView label | 内容 | 位置 |
| --- | --- | --- |
| `main` | Vue 壳：左侧栏 + 各栏标签栏 + 分隔条 | 铺满整个窗口 |
| `wv-{serviceId}` | 服务首页 | 所在分屏栏的内容区 |
| `wv-{serviceId}-t-{suffix}` | 该服务额外标签页 | 同上 |

分屏时同时 `show()` 各栏当前标签对应的 WebView，其余 `hide()`。未进入过的服务仍是首次点击（或分屏放入该栏）时才创建。已打开页保留内存状态，侧栏用整行底色标出当前项、图标右上角在线绿点标出已打开页；可关闭以销毁 WebView 释放内存。同一服务不能同时出现在两栏。

```
App.vue（侧栏 + 管理/设置 / 各分屏栏标签栏 + 分隔条）
  ├─ usePointerReorder()  # 侧栏拖动排序
  └─ useWorkspace()
       ├─ persist.ts     → workspace.json
       ├─ layout.ts      → 各栏逻辑像素 bounds
       ├─ menu.ts        → popup_menu / menu-action
       └─ invoke / 事件
            create_content_webview
            navigate_content_webview   # back | forward | reload | stop
            load_content_webview
            content_webview_history
            close_content_webview
            set_content_zoom
            popup_menu
            listen content-page-state
            listen content-open-tab
            listen menu-action
```

内容 WebView 在 Rust 中创建：`WebviewBuilder` + `window.add_child`。`window.open` / `target=_blank` 的 http(s) 由 `on_new_window` 发给侧栏 `content-open-tab`，再创建额外标签；始终 `Deny` 系统新窗口。页面加载开始 / 完成或标题变化时发送 `content-page-state`（含可选 `loading`）。应用菜单与原生弹出菜单通过 `menu-action` / `popup_menu` 回传 `main`。

内容 WebView 的 label 规则：首页为 `wv-` + 服务 id；额外标签为 `wv-{id}-t-` + 字母后缀。Tauri label 不要包含数字；自定义 id 形如 `custom-abcdefghij`。

`popup_menu` 必须用窗口内坐标调用 `popup_menu_at`（标签栏按钮把点击位置传下去）。选中项经 `on_menu_event` → `menu-action` 进事件循环，不是 `popUpMenu` 同步返回；Rust 侧菜单关掉后会短等再把 id 回给前端。

### 性能与更新调度

- WebView 布局串行执行；拖动分隔条及窗口缩放请求按帧合并，执行中的更新完成后使用最新布局。测量窗口的请求不会被同帧的分隔条更新覆盖。
- 记录已显示页面及上次成功应用的 bounds，仅对位置、尺寸或可见性发生变化的页面调用原生 API。切换时先隐藏旧页，管理 / 设置页在内容页隐藏完成后显示；关页时清除布局缓存。
- 原生加载 / 标题事件仍即时更新状态；仅在窗口聚焦、壳文档可见且显示网页时，每 2 秒补查当前各栏的 History / URL / 焦点。同一页面只保留一个进行中的查询，状态未变时保留 Vue 对象引用。
- 页面查找输入按 150ms 防抖。相同关键词复用匹配范围；正文、DOM、属性或窗口尺寸变化后重建。MutationObserver 仅在查找期间存在，关闭查找时断开；扫描内缓存元素样式并顺序定位匹配节点，避免重复遍历。
- 页面仍按需创建并保留对话内存状态，不自动销毁隐藏页。每服务最多 8 个标签，全局没有自动回收策略；大量网页的内存占用仍需通过关闭标签或服务页面释放。

## 4. 数据

| 类别 | 存储 | 写入方 |
| --- | --- | --- |
| 自定义服务列表、侧栏启用的内置 ID、上次选中 ID、分屏各栏服务与宽度比例、固定分屏菜单、锁定、主题、侧栏折叠、服务排序、各服务缩放 | `~/Library/Application Support/com.yxhc.aipanel/workspace.json` | `tauri-plugin-store` |
| 窗口尺寸与位置 | 同目录，由 `tauri-plugin-window-state` 写入 | 该插件 |
| Cookie、站点 localStorage | 系统 WebKit / HTTPStorages | WKWebView |

启动时：内置目录始终来自 `src/types.ts` 的 `CATALOG_SERVICES`；侧栏只显示 `enabledServiceIds` 中的内置项，再合并 store 里 `builtin: false` 的自定义项。这样内置 URL / 图标更新不会被旧缓存挡住。

侧栏展开 `SIDEBAR_WIDTH_EXPANDED = 192`，图标栏 `SIDEBAR_WIDTH_RAIL = 80`，工具栏高度 `TAB_BAR_HEIGHT = 40`，分屏分隔条 `SPLITTER_WIDTH = 8`，最多 `MAX_PANES = 3`，固定分屏最多 `MAX_SAVED_LAYOUTS = 12`。各栏顶部采用 40px 单行紧凑工具栏（整合导航按钮、地址栏/多标签切换、分屏与更多按钮；单标签时隐藏冗余服务标题以节省空间）。布局计算与 `main` WebView 实际尺寸都使用它们，不是仅靠 CSS 裁切。各栏宽度按比例分配内容区（扣除分隔条），最小约 200px。打开管理或设置页时内容 WebView 全部 `hide()`，页面由 `main` 铺满侧栏右侧。固定分屏 id 形如 `layout-abcdefgh`，只出现在侧栏，不创建 WebView。颜色只走 CSS 变量 `--c-*`。右键 / 分屏选择器 / 标签更多菜单必须用 Rust `popup_menu`，DOM 弹层会被子 WebView 盖住。

## 5. 权限

[`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json)：

- 仅 `webviews: ["main"]`
- 允许 store、拖拽窗口、`setTheme`、子 WebView 的 show/hide/close/resize/focus
- opener（仅 http/https）、clipboard 写文本、dialog 确认、window-state

内容页 `wv-*` 不注入这些能力。

## 6. 文件职责

| 路径 | 职责 |
| --- | --- |
| [`src/types.ts`](../src/types.ts) | 服务模型、内置目录 `CATALOG_SERVICES`、默认侧栏 ID、分屏常量、主题/缩放类型、固定分屏 `SavedLayout`、名称规范化、id / 标签 label 与 URL 规范化 |
| [`src/App.vue`](../src/App.vue) | 窗口壳：侧栏列表、折叠、排序、右键菜单、固定分屏、管理/设置入口、多栏标签栏与分隔条 |
| [`src/components/ServiceIcon.vue`](../src/components/ServiceIcon.vue) | 侧栏 / 管理网格的品牌图标或字头 |
| [`src/components/ServiceManager.vue`](../src/components/ServiceManager.vue) | 启动台式管理页：搜索、目录网格、自定义添加 / 编辑 |
| [`src/components/SettingsPage.vue`](../src/components/SettingsPage.vue) | 外观、侧栏折叠、快捷键一览、关于 |
| [`src/components/TabBar.vue`](../src/components/TabBar.vue) | 后退/前进/刷新或停止、页面标签、分屏/关闭/更多 |
| [`src/composables/useWorkspace.ts`](../src/composables/useWorkspace.ts) | 服务、分屏栏、固定分屏菜单（含重命名与排序）、锁定、标签状态、创建/切换/关闭 WebView、窗口缩放 |
| [`src/composables/usePointerReorder.ts`](../src/composables/usePointerReorder.ts) | 侧栏服务 / 固定分屏的指针拖动排序 |
| [`src/composables/useTheme.ts`](../src/composables/useTheme.ts) | 浅色/深色/系统与 `window.setTheme` |
| [`src/composables/useToast.ts`](../src/composables/useToast.ts) | 3 秒自动消失的提示 |
| [`src/lib/menu.ts`](../src/lib/menu.ts) | 原生弹出菜单与 `menu-action` |
| [`src/lib/icons.ts`](../src/lib/icons.ts) | `logo` id 到 `src/assets/icons` SVG 的映射 |
| [`src/assets/logo.svg`](../src/assets/logo.svg) | AiPanel 主应用图标矢量源文件（含分屏、星芒与名称） |
| [`src/assets/logo-wordmark.svg`](../src/assets/logo-wordmark.svg) | AiPanel 横版品牌标识（微标 + 字标） |
| [`src/lib/layout.ts`](../src/lib/layout.ts) | 侧栏、标签栏、分屏栏 bounds 与分隔条比例 |
| [`src/lib/persist.ts`](../src/lib/persist.ts) | store 读写与内置/自定义/分屏/主题/排序/缩放合并 |
| [`src-tauri/src/browser.rs`](../src-tauri/src/browser.rs) | 网页脚本注入、登录 URL 识别、⌘+左键使用默认浏览器打开拦截 |
| [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) | 子 WebView 生命周期、UA、新窗口改为开标签、前进/后退/刷新/停止、缩放、应用菜单、`popup_menu` |
| [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) | 窗口尺寸、Overlay 标题栏、macOS ad-hoc 签名 |
| [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) | `unstable`、store / opener / dialog / clipboard / window-state |
| [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) | 侧栏 IPC 白名单 |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | 推送 `master` 后打 `build-N` tag，编译 Windows / macOS 安装包并发布 Release |

## 7. 扩展点

- 新增内置 AI：改 `CATALOG_SERVICES`，并把 SVG 放到 `src/assets/icons/`；若要默认出现在侧栏，加入 `DEFAULT_ENABLED_IDS`。
- 改侧栏宽度、标签栏高度、分屏栏数或分隔条：改 `SIDEBAR_WIDTH_EXPANDED` / `SIDEBAR_WIDTH_RAIL` / `TAB_BAR_HEIGHT` / `MAX_PANES` / `SPLITTER_WIDTH`（布局会跟着变）。
- 改新窗口策略：改 `lib.rs` 的 `on_new_window`。
