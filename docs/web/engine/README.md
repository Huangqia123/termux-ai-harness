# 网页版本地引擎启动说明

网页版（`../index.html`）只打包了界面，**不含推理引擎**。模型和 `llama-server` 都跑在你自己的设备上，网页通过 `127.0.0.1` 连接本机服务，聊天内容不会经过我们的服务器。

## 1. 准备模型

选一个 GGUF 模型下载到本机模型目录：

- 中文入门：`qwen2.5-1.5b-instruct-q4_k_m.gguf`（约 1.1GB，1.2~1.5GB 内存）
- 能识图：`Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf`（约 1.9GB，3~4GB 内存，同目录放对应的 `mmproj-*.gguf`）

下载地址（hf-mirror，国内可直连）见仓库 `app/main.js` 目录或 https://hf-mirror.com 。

模型目录（脚本默认查找位置）：

- Termux / Linux：`~/.termux-ai/models`
- Windows：`%USERPROFILE%\.termux-ai\models`

## 2. 准备 llama-server

- **Windows**：到 llama.cpp Releases 下载预编译包，把 `llama-server.exe` 放进 PATH 或脚本同目录。
- **Linux**：用发行版包或自行编译 llama.cpp，保证 `llama-server` 在 PATH。
- **Termux（安卓）**：在 Termux 里编译 llama.cpp（`pkg install build-essential cmake git && git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp && cmake -B build && cmake --build build --config Release -j4`），编译产物 `llama-server` 放到 PATH。

## 3. 启动引擎

| 平台 | 命令 |
|---|---|
| Termux | `sh termux.sh`（或 `sh termux.sh /路径/模型.gguf`） |
| Linux | `bash linux.sh`（或 `bash linux.sh /路径/模型.gguf`） |
| Windows | `windows.cmd`（或 `windows.cmd C:\路径\模型.gguf`） |

启动成功后日志里会出现 `listening on 127.0.0.1:8080`。脚本已加 `--cors "*"`，允许网页跨域访问本机端口。

## 4. 打开网页版

在同一台设备的浏览器里打开官网的「网页浏览版」入口，页面会自动探测 `127.0.0.1:8080` / `8082`，探测到后进聊天。

## 限制（网页版和桌面 App 的区别）

- 浏览器没有本地文件权限：模型必须在命令行里下载，网页不能替你下。
- 网页版**没有网页截图**能力（`capturePage` 是桌面端 Electron 的接口）；打开网址只能读取正文文字。
- 部分站点有跨域限制，浏览器直抓会失败；这种情况请用桌面 App 或安卓包。
- 识图、联网搜索、引擎日志面板在网页版里保持界面，但联网搜索在浏览器端不可用。
