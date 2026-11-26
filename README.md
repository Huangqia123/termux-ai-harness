# Termux AI Harness

**官网 / Landing page:** https://huangqia123.github.io/termux-ai-harness/

> **English:** Turn an Android device into a fully offline AI terminal. A local llama.cpp server does the inference; `termuxai` chats, `termuxai-harness` turns plain language into shell commands you approve before they run. Everything stays on `127.0.0.1` — no internet, no uploads, no cloud API.

把一台 Android 平板变成**完全离线的本地 AI 终端**：llama.cpp 在本机跑模型，`termuxai` 负责聊天，`termuxai-harness` 负责把你的自然语言翻译成 shell 命令并在你确认后执行。

全程 `127.0.0.1`，不联网、不上传、不依赖任何云端 API。1~2 秒一次响应。

> AI 不该按次计费。它应该装在你已经拥有的设备里，用多久都不再额外收钱。

## 它解决什么问题

在 Termux 里折腾东西，经常要回想 `curl` 的参数、`jq` 的过滤语法、某个包该怎么装。这套工具的思路很简单：

- 不想记命令语法 → 说人话，让它生成命令，看一眼，回车执行
- 想要纯对话 → 用聊天模式，带上下文记忆
- 不想被 AI 删库 → 高危命令黑名单 + 人工确认双保险

## 组成

| 组件 | 作用 |
| --- | --- |
| `llama-server` | 本地推理服务，监听 `127.0.0.1:8080`，提供 OpenAI 兼容接口 |
| `bin/termuxai` | 纯聊天客户端，维护多轮上下文 |
| `bin/termuxai-harness` | Agent 形态，自然语言 → shell 命令 → 人工确认 → 执行 → 失败回灌重试；顺带能回答问题 |
| `install.sh` | 一键装依赖并把两个脚本塞进 `$PREFIX/bin` |

链路：

```
你输入自然语言
      ↓
termuxai-harness  (curl)
      ↓
127.0.0.1:8080  llama-server  (本地推理)
      ↓
回复以 CMD: 或 TEXT: 开头
      ├─ TEXT:  → 直接打印，不碰 shell
      └─ CMD:   → 黑名单检查 → 展示 → 你按 y → bash -c 执行 → 输出回显
```

## 图形界面（v1.0.1）

不想敲命令行也能用。桌面端双击即开，安卓端装 APK。

| 平台 | 下载文件 | 说明 |
| --- | --- | --- |
| Android | `TermuxAIHarness-1.0.1-android.apk` | 界面壳，推理仍走 Termux 里的 `llama-server`；打开后自动扫描 `8080–8091` |
| Windows 10/11 | `TermuxAIHarness-1.0.1-win-x64.zip` | 解压双击 `.exe`。未签名，SmartScreen 会拦一次 |
| macOS | `TermuxAIHarness-1.0.1-mac-arm64.zip`（Apple 芯片）<br>`TermuxAIHarness-1.0.1-mac-x64.zip`（Intel） | 未签名且未公证，首次需右键 → 打开 |
| Linux | `TermuxAIHarness-1.0.1-linux-x86_64.AppImage`<br>`TermuxAIHarness-1.0.1-linux-amd64.deb` | AppImage 记得 `chmod +x`；deb 走 `sudo dpkg -i` |

全部挂在 [v1.0.1 release](https://github.com/Huangqia123/termux-ai-harness/releases/tag/v1.0.1)。

### 打开就进聊天

启动后什么都不用点：

1. 扫本地 GGUF —— 应用目录、`~/models`、`~/.termux-ai/models`、`~/.local/share/termux-ai/models`、`~/storage/downloads`
2. 只找到 1 个 → 直接用；找到 2 个以上 → 列出来让你挑
3. 一个都没有 → 列出官网那 6 个，按内存自动选推荐档并直接下载（`.part` 临时文件，下完自动改名）
4. 拉起 `llama-server`，`8080` 被占就顺延 `8081~8091`，轮询 `/health` 最多 90 秒
5. 就绪 → 自动切到聊天界面

引擎不内嵌在安装包里：桌面端用系统上已有的 `llama-server`（`PATH`、`~/.local/bin`、`/usr/local/bin` 都会找，也能手动指定）；安卓端用 Termux 里编好的那一份。这样安装包才 100MB 左右，而不是塞进一个 2GB 的模型和一套推理库。

## 聊天和命令走两条路

模型每条回复都以 `CMD:` 或 `TEXT:` 开头，harness 按前缀分流：

- `TEXT:` → 直接打印成回答，永远不进 shell
- `CMD:` → 展示命令，等你按 `y`

没有前缀时按形状兜底：多行文字当回答，单行且首词是真实可执行命令才当命令。宁可把命令当话打印出来，也不把话当命令执行——v1.0.1 修的就是这个方向搞反的问题。

## 平台支持

| 平台 | 脚本 | 安装 |
| --- | --- | --- |
| Termux (Android) | `bin/termuxai`、`bin/termuxai-harness`（bash） | `bash install.sh` |
| Linux（Debian/Arch/Fedora 等） | 同上（bash） | `bash install.sh` 或 `bash install.sh --system` |
| macOS | 同上（bash） | `bash install.sh` |
| Windows 10/11 | `windows/termuxai.ps1`、`windows/termuxai-harness.ps1`（PowerShell 5.1+ / 7+） | `powershell -ExecutionPolicy Bypass -File windows/install.ps1` |
| 纯血鸿蒙（HarmonyOS NEXT） | — | 未适配：没有可用的 POSIX shell，装不了 llama.cpp |
| iOS / iPadOS | — | 未适配：App 沙箱里跑不了这套脚本 |

Linux/macOS 默认装到 `~/.local/bin`，不需要 sudo；`--system` 装到 `/usr/local/bin`。Termux 固定装 `$PREFIX/bin`。Windows 装到 `%LOCALAPPDATA%\TermuxAI\bin` 并加入用户 PATH，附带 `.cmd` 启动器，在 cmd 里也能直接敲 `termuxai`。

只要设备能提供一个 POSIX shell 并跑得动 llama.cpp，就能用。纯血鸿蒙和 iOS 不在名单里——不是没做，是这两个系统上根本没有让 llama.cpp 落地的地方；鸿蒙靠第三方兼容层运行，属于计划外。

两个平台的脚本逻辑一致，环境变量也完全一致，细节见 [PLATFORMS.md](PLATFORMS.md)。

## 安装

前提：Termux（F-Droid 或 GitHub 版），已 `pkg install curl jq`。

```bash
git clone https://github.com/Huangqia123/termux-ai-harness.git
cd termux-ai-harness
bash install.sh
```

手动安装也行：

```bash
cp bin/termuxai bin/termuxai-harness "$PREFIX/bin/"
chmod +x "$PREFIX/bin/termuxai" "$PREFIX/bin/termuxai-harness"
```

## 先起服务

模型自己准备，随便一个 GGUF 就行，小模型够用。不想自己挑的话，[MODELS.md](MODELS.md) 按低 / 中 / 高配分了三档，每档配中英文两个模型，也可以直接从 Release 下载或跑 `./download-models.sh low-cn`。

```bash
llama-server -m ./Qwen1.5-0.5B-Chat-Q4_K_M.gguf -c 1024 --port 8080
```

> 注意：这个版本的 llama.cpp 用 `--port`，不是 `-p`。窗口保持挂着别关，关了服务就没了。

## 聊天模式

```bash
termuxai
```

```
You> 用一句话解释什么是 GGUF
AI>  GGUF 是 llama.cpp 使用的模型文件格式，把权重和元数据打包进单个文件。
```

支持 `/clear` 清空上下文、`/exit` 退出。

## Agent 模式

```bash
termuxai-harness
```

```
Task> 看看当前目录里最大的那个文件
generated>
ls -S | head -n 1
run it? [y/N] y
--- output ---
model.gguf
--- exit code: 0 ---
```

流程是**人在回路**：命令一定先打印出来，按 `y` 才执行。回车或 `n` 直接跳过。

失败之后会把命令和报错一起回灌给模型，让它给出修正版本，最多重试 `TERMUX_AI_MAX_RETRY` 次。

### 高危拦截

命中下面这些模式会直接拒绝执行，连 `y` 都不给你按的机会：

`rm -rf` / `rm -r` / `rm --recursive`、`mkfs`、`dd of=`、`shutdown` / `reboot` / `poweroff` / `halt`、`chmod -R 777 /`、把根目录往别处 `mv`、fork bomb。

这是**黑名单**，不是沙箱。真要做危险操作，还是得自己长眼睛。

## 环境变量

两个脚本都支持：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `TERMUX_AI_URL` | `http://127.0.0.1:8080/v1/chat/completions` | 推理接口地址 |
| `TERMUX_AI_MODEL` | 空 | 模型名，llama.cpp 一般忽略，接其他后端时有用 |
| `TERMUX_AI_TEMPERATURE` | `0.2` / `0.1` | 采样温度，harness 默认更低更死板 |
| `TERMUX_AI_MAX_TOKENS` | `512` / `256` | 单次输出上限 |
| `TERMUX_AI_TIMEOUT` | `120` | 请求超时（秒） |

只有 harness 支持：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `TERMUX_AI_HARNESS_SYSTEM` | 内置 | 覆盖系统提示词 |
| `TERMUX_AI_AUTO_RETRY` | `0` | 设为 `1` 则跳过确认直接执行，危险 |
| `TERMUX_AI_MAX_RETRY` | `2` | 失败后自动重试次数 |

## 能力边界

- 权限就是当前 Termux 用户的权限，没有 root，不是沙箱，不会突破 Android 的隔离
- 输出质量取决于你跑的那个模型，0.5B 的模型在复杂管道上会犯傻
- 上下文存在内存里，退出即失忆
- 不是全自主 Agent：没有任务规划、没有工具调用协议、没有长期记忆，只有一轮生成加人工确认

## License

MIT，见 [LICENSE](LICENSE)。
