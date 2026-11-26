# Changelog

## v1.0.1 - 2026-11-26

修一条把聊天当命令跑的路径，外加 3B 模型的实测记录。

### 修复
- **回复分流**：模型输出改为 `CMD:` / `TEXT:` 前缀协议。`TEXT:` 直接打印成回答，永不进入 shell；`CMD:` 才展示、确认、执行。之前任何回复都被当命令跑，问一句"你是什么模型"会得到 `command not found`
- **无前缀兜底**：模型忘记加前缀时按形状判断——多行文字当回答，单行且首词是真实可执行命令才当命令。判断出错时宁可打印文字，不会误执行
- **兼容旧标记**：`【CMD】`、`【TEXT】`、`CMD：`（全角冒号）、`[CMD]` 全部能识别，不用改模型习惯
- **字段兜底**：读取回复时同时尝试 `.choices[0].message.content` 与 `.choices[0].text`，兼容不同 llama.cpp 构建的返回格式
- Windows PowerShell 版同步上述逻辑，`ConvertFrom-Reply` 负责分流

### 模型
- 高配档改用 **Qwen2.5-3B-Instruct Q4_K_M**（约 1.8~2.1GB），比 1.5B 明显更能守格式、少复读
- 荣耀平板 X9 实测（Qwen2.5-3B Q4_K_M，`-c 2048`）：常规 9~15 token/s，短提示命中缓存时可冲到 46 token/s
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
