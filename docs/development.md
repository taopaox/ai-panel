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
pnpm tauri dev      # 桌面开发
pnpm tauri build    # 打包
```

不要用浏览器打开 `http://localhost:1420` 做功能验收：那里没有子 WebView，也没有 Tauri IPC。

开发以 `pnpm tauri dev` 拉起的那一个进程为准。直接 `open` 调试二进制可能再起一个实例。

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
| 服务列表、上次选中、分屏栏、侧栏启用的内置 ID、固定分屏菜单、锁定 | `~/Library/Application Support/com.yxhc.aipanel/workspace.json` |
| 登录 Cookie | 系统 WebKit / `HTTPStorages` 下与 `ai-panel`、`com.yxhc.aipanel` 相关的项 |

只重置列表：删除 `workspace.json`。连登录一起清：还要清除该 App 的 WebKit 站点数据。

## 5. 验收

按 [需求文档 §8](requirements.md#8-验收标准) 在桌面窗口中过一遍：切换、登录持久、管理页加入/移出内置项、自定义添加/删除、窗口缩放、始终单窗口、标签栏、当前页后退/前进/刷新、分屏并排与拖动分隔条、固定分屏到侧栏、锁定后不能改网页、侧栏打开状态与关页释放内存。

## 6. 已知限制

- 部分站点对 WebKit 不友好（验证码、语音、Chrome-only API）。v1 保证文字对话路径。
- 隐藏中的 WebView 可能被系统节流，切回后一般恢复。
- 侧栏关闭页面会销毁该服务全部内容 WebView 以释放内存，登录 Cookie 仍在；再打开会重新加载页面。
- `create_content_webview` 必须是 async 命令（Windows 上同步创建会 deadlock；Mac 同样按此实现）。
- Tauri 多 WebView 仍挂在 `unstable` feature 上。
- 前进/后退可用性来自页面 History / Navigation API。站点若用自己的应用内栈，可能和侧栏按钮不一致；无 Navigation API 时前进按钮可能一直不可用。
- `window.open` / `target=_blank` 会在当前服务下新开标签。依赖真实系统弹窗、`window.close` 或 `window.opener` 回传的流程可能不完整。额外标签不写入 `workspace.json`，退出后只保留各服务首页与分屏各栏的首页。
- 分屏最多 3 栏；同一服务不能同时出现在两栏。拖动分隔条依赖指针捕获，若系统把后续移动事件交给内容 WebView，松手后再拖一次即可。
- 固定分屏最多 12 个。锁定只冻结该菜单里各栏对应哪个服务，不拦住离开：点其他服务进入该页面，再点分屏菜单回来。站点内对话、标签、前进后退仍可用。解锁后改各栏网页会写回当前这项分屏菜单。
