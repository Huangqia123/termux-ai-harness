# Changelog

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
