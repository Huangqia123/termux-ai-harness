# Termux AI Harness

把任何一台机器变成离线 AI 终端：本地 llama.cpp 推理 + 一个会干活的终端客户端。

- 🔒 全链路 `127.0.0.1`，断网照常工作，不要 API Key，没有额度
- 🧠 自动找 `llama-server`、自动扫 GGUF、一键下载模型、自动进聊天
- 🌐 **会读网页**：聊天里带上网址，应用用离屏窗口真实打开它，取回渲染后的正文 + 截图，交给模型回答
- 💻 说话和命令分流：`TEXT:` 直接回答，`CMD:` 先展示、按 `y` 才执行，危险命令直接拦
- 🖥️ 桌面应用覆盖 Windows / macOS（Intel + Apple 芯片）/ Linux；Android 与 Termux 走同一套逻辑

## 下载

官网：[huangqia123.github.io/termux-ai-harness](https://huangqia123.github.io/termux-ai-harness/)（备用站 [/backup/](https://huangqia123.github.io/termux-ai-harness/backup/)）

版本与文件名由页面实时从 GitHub Releases 拉取，下载走国内加速节点。

## 本地跑

```bash
cd app
npm install
npm start          # 开发模式
npm run dist      # 打包当前平台
```

需要 `llama-server`（[llama.cpp](https://github.com/ggml-org/llama.cpp) 的 server 可执行文件）在 `PATH` 或 `~/.local/bin`，应用会自动检测；没有也能启动，界面会告诉你缺什么。

## 网页读取是怎么做的

`app/web.js` 用一个离屏 `BrowserWindow` 加载目标网址，`executeJavaScript` 取 `document.body.innerText`，`capturePage()` 截首屏落盘到 `userData/shots/`，正文按上下文预算截断。不依赖外部 API，也不把网页内容上传到任何地方。

## 许可

MIT © Huangqia123
