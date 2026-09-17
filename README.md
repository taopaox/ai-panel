# AI Workspace

用 Tauri 2 + Vue 3 把多个 AI 网站集中到一个 Mac 窗口里：左侧切换服务，右侧加载完整网页，并可分屏同时打开多个站点。登录状态保存在 App 自己的 WebView 中。

- 规范：[`AGENTS.md`](AGENTS.md)
- 文档：[需求](docs/requirements.md) · [架构](docs/architecture.md) · [开发](docs/development.md)

## 开发

需要 Node.js、pnpm 和 [Rust](https://www.rust-lang.org/tools/install)。

```bash
pnpm install
pnpm tauri dev
```

打包：

```bash
pnpm tauri build
```
