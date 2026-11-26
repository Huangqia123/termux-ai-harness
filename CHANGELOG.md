# Changelog

## v1.0.2.7 - 2026-11-26

预发布。修「已经显示已连上，但发消息报『连不上』」。

### 根因
Termux 日志里三处 `stop: cancel task` 都发生在请求开始后约 12 秒，`n_tokens` 只到 32/38。
这不是网络断了，是 APK 的 `readTimeout` 只有 12 秒：3B 模型在手机上首个 token 出得慢，客户端先超时断开，服务端记成 cancel。`/v1/models` 探测很快，所以状态灯一直是绿的。

### 修复
- 聊天改为 **SSE 流式**：新增 `chatStream(messagesJson, cbId)`，逐行读 `data:` 增量，每个 token 立刻推给界面（`window.__onChunk`）
- `readTimeout` 提到 180 秒、`connectTimeout` 10 秒；流式下每 token 都有数据，实际不会触发超时
- 出错时不再一律说「连不上」，而是显示 `请求中断：<异常名> <原因>` 或 `HTTP <code>：<服务端原文>`
- 气泡边流边涨，不用干等整段返回

## v1.0.2.6 - 2026-11-26

预发布。修「点保存时斜杠 v1 自动消失」。

### 修复
- **真正的根因找到了**：不是输入法，也不是路径解析。`index.html` 里 `['addr-host', 'addr-port'].forEach(...)` 紧跟在上一行的函数表达式赋值后面，缺少分号，被 JS 解析成 `函数[...]` 下标访问，得到 `undefined` 再调 `.forEach` 直接抛错。脚本从这里中断，后面的「保存 / 打开 Termux / 启动引擎」按钮全部没绑上事件，所以点保存既没反应、也像是 `/v1` 被吞了
- 该行前补分号，脚本跑通；`probe()` 正常执行，状态灯与地址不再停在初始「检测中…」

### 变化
- 设置面板改成「主机」+「端口」两个输入框，中间冒号、右侧 `/v1` 是静态后缀，路径不再参与解析，物理上不可能丢
- 新增 Java 接口 `setHostPort(host, port)`，内部强制路径为 `/v1`
- 地址预览与状态胶囊统一读 Java 返回的 `url`（恒含 `/v1`）

## v1.0.2.5 - 2026-11-26

预发布。补 `/v1` 后缀输不进去这件事。

### 修复
- **地址里的路径被吞了**：v1.0.2 的 `setEndpoint` 里有一行 `indexOf('/')` 截断，把 `/v1` 直接砍掉，所以无论怎么填，保存后都只剩 `host:port`。现在 host、port、path 三段分开存，`/v1` 原样保留
- 输入框 `inputmode` 从 `url` 改成 `text`，部分输入法的 URL 键盘不给斜杠
- 只写 `192.168.1.40:8080` 也行，保存时自动补 `/v1`；填了 `/v1/chat/completions` 这种完整端点会自动削回 `/v1`
- 面板加「补上 /v1」按钮，不用手动打斜杠

### 不变
- 默认 `127.0.0.1:8080/v1`，端口被占用按序试 `8081`–`8091`
- 地址存 `SharedPreferences`，状态灯只在 `/v1/models` 真返回时才绿
- 签名沿用 v1.0.1 / v1.0.2，可直接覆盖安装

## v1.0.2 - 2026-11-26

安卓端补上接口地址设置，不再只会连 `127.0.0.1:8080`。

### 新增
- 右上角状态胶囊可点：弹出底部面板，直接输入 `192.168.1.40:8080`，保存即生效并立即重连
- 默认仍是 `127.0.0.1:8080`；连不上时按序试 `8081`–`8091`
- 地址持久化在 `SharedPreferences`，重启 App 不用重填
- 「恢复 127.0.0.1:8080」一键回到默认

### 修复
- 状态灯不再假绿：只有 `/v1/models` 真返回模型列表才变绿，否则红灯并显示当前地址
- 面板的 `.hidden` 被 `.sheet-mask{display:flex}` 覆盖，导致设置面板一开就挡在首屏；改为 `!important` 失效

### 安装
APK 沿用 v1.0.1 的签名，可直接覆盖安装，不用先卸载。桌面端三个平台没有改动，仍是 v1.0.1 的包。

## v1.0.1 - 2026-11-26

修一条把聊天当命令跑的路径，外加 3B 模型的实测记录。

### 修复
- **回复分流**：模型输出改为 `CMD:` / `TEXT:` 前缀协议。`TEXT:` 直接打印成回答，永不进入 shell；`CMD:` 才展示、确认、执行。之前任何回复都被当命令跑，问一句"你是什么模型"会得到 `command not found`
- **无前缀兜底**：模型忘记加前缀时按形状判断——多行文字当回答，单行且首词是真实可执行命令才当命令。判断出错时宁可打印文字，不会误执行
- **兼容旧标记**：`【CMD】`、`【TEXT】`、`CMD：`（全角冒号）、`[CMD]` 全部能识别，不用改模型习惯
- **字段兜底**：读取回复时同时尝试 `.choices[0].message.content` 与 `.choices[0].text`，兼容不同 llama.cpp 构建的返回格式
- Windows PowerShell 版同步上述逻辑，`ConvertFrom-Reply` 负责分流

### 图形界面（GUI）
- 新增 Electron 桌面应用 `app/`：模型扫描 → 自动下载 → 拉起 `llama-server` → 自动进聊天，全程无感
- 启动即自动：本地有 1 个模型直接用，有 2 个以上让你挑，没有就按内存从官网 6 个里选推荐档自动下载
- `8080` 被占用时自动顺延到 `8081~8091`，不再直接报 `couldn't bind HTTP server socket`
- 交付 5 个二进制：Android APK、Windows x64 zip、macOS x64/arm64 zip、Linux AppImage + deb，全部挂在 v1.0.1 这一版
- Android APK 是界面壳：不内嵌 llama.cpp，通过 `127.0.0.1` 连 Termux 里的引擎，可用 RUN_COMMAND 让 Termux 代启服务

### 模型
- 高配档改用 **Qwen2.5-3B-Instruct Q4_K_M**（约 1.8~2.1GB），比 1.5B 明显更能守格式、少复读
- 荣耀平板 X9 实测（Qwen2.5-3B Q4_K_M，`-c 2048`）：常规 9–15 token/s，短提示命中缓存时可冲到 46–50 token/s
- 注意：3B 常驻内存约 2.2~2.6GB，平板同时开其他应用容易被 Android 杀进程，建议 `-t 4` 限线程并在空闲内存充足时启动

### 文档
- README 增加「聊天和命令走两条路」小节与分流版链路图
- MODELS.md 补充实测速度与线程建议

## v1.0.0 - 2026-11-25

首个公开版本。同日补充 Windows 与 Linux/macOS 适配，版本号不变。

### 新增
- `termuxai`：基于本地 llama.cpp 服务的离线聊天客户端，支持多轮上下文
- `termuxai-harness`：自然语言转 shell 命令的 Agent，命令展示 + 人工确认后才执行
- 失败回灌重试：命令执行失败后把输出交回模型重试，上限可配
- 高危命令黑名单：递归删除、磁盘格式化、关机重启、`chmod 777 /`、fork bomb 等直接拒绝
- 环境变量覆盖接口地址、模型名、温度、超时与重试次数
- `install.sh` 一键安装，自动补 `curl`、`jq` 依赖
- MIT 许可协议

### 跨平台
- `install.sh` 增加平台检测：Termux 装 `$PREFIX/bin`，Linux/macOS 默认装 `~/.local/bin`，支持 `--system` 装 `/usr/local/bin`
- 新增 `windows/termuxai.ps1` 与 `windows/termuxai-harness.ps1`，PowerShell 5.1+ / 7+ 可用，`Invoke-RestMethod` + `ConvertTo-Json` 替代 curl + jq
- 新增 `windows/install.ps1`，装到 `%LOCALAPPDATA%\TermuxAI\bin`、生成 `.cmd` 启动器、写用户级 PATH
- Windows 侧独立的高危黑名单：`Remove-Item -Recurse`、`format`、`diskpart`、`Clear-Disk`、`shutdown`、`reg delete`、`Set-ExecutionPolicy Unrestricted` 等
- 新增 `PLATFORMS.md`，逐平台记录安装差异与排错

### 已知限制
- 黑名单是模式匹配，不是沙箱，不能覆盖所有危险命令
- 上下文仅存在于内存，退出后清空
- 仅适配 OpenAI 兼容的 `/v1/chat/completions` 接口
