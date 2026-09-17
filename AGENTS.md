# Agent 规范

项目文档在 [`docs/`](docs/README.md)：[需求](docs/requirements.md)、[架构](docs/architecture.md)、[开发](docs/development.md)。改代码前先读对应文档。本文件只列约束。

**功能或结构有变化时，同一轮补齐 docs/（及必要时本文件）。文档落后于代码视为未完成。**

## 栈

- 桌面：Tauri 2（`unstable`，多 WebView）
- 前端：Vue 3 `<script setup lang="ts">`、Vite、UnoCSS
- 包管理：pnpm（不要改成 npm / yarn）
- 配置：`tauri-plugin-store`；Cookie 交给系统 WebView，不要自己读写

## 必须遵守

- 右侧内容页只能是原生子 WebView，禁止 iframe / HTML `<webview>`。
- Capabilities 只授给 `"webviews": ["main"]`。禁止改成 `"windows": ["main"]`，否则第三方页面能调 IPC。
- 子 WebView 用 Rust `window.add_child` 创建；label 为 `wv-{id}`，id 只用字母和 `-`。
- 登录弹窗在当前内容 WebView 内跳转，不要新开 Mac 窗口。
- User-Agent 用 Safari/WebKit，不要伪装 Chrome。
- 不要读取 Edge / Safari Cookie。

## 命令

```bash
pnpm install
pnpm tauri dev
pnpm tauri build
```

验收必须用 `pnpm tauri dev` 的桌面窗口，不要用浏览器打开 Vite 页。
