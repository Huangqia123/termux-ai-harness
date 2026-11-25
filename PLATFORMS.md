# Platforms

同一个思路，三套落地方式。脚本行为一致，差异只在安装位置和依赖命令上。

| | Termux | Linux | macOS | Windows |
| --- | --- | --- | --- | --- |
| 脚本 | `bin/termuxai`、`bin/termuxai-harness` | 同左 | 同左 | `windows/termuxai.ps1`、`windows/termuxai-harness.ps1` |
| 解释器 | bash (Termux) | bash 3.2+ | bash 3.2+ | PowerShell 5.1+ / 7+ |
| 安装目标 | `$PREFIX/bin` | `~/.local/bin` 或 `/usr/local/bin` | 同左 | `%LOCALAPPDATA%\TermuxAI\bin` |
| HTTP | curl | curl | curl | `Invoke-RestMethod` |
| JSON | jq | jq | jq | `ConvertTo-Json` / `ConvertFrom-Json` |
| 依赖 | `pkg install curl jq` | `apt/dnf/pacman install curl jq` | `brew install curl jq` | 无（PowerShell 自带） |

## Termux

```bash
bash install.sh
```

自动 `pkg install curl jq`，装到 `$PREFIX/bin`。

## Linux

```bash
sudo apt install curl jq     # Debian/Ubuntu
sudo dnf install curl jq     # Fedora
sudo pacman -S curl jq       # Arch

bash install.sh              # 装到 ~/.local/bin，无需 root
bash install.sh --system     # 装到 /usr/local/bin，需要写权限
```

装完如果 `~/.local/bin` 不在 PATH，脚本会打印需要追加的那一行，自己塞进 `~/.bashrc` 或 `~/.zshrc`。

## macOS

```bash
brew install curl jq
bash install.sh
```

脚本里用到的 `install -m 755`、`jq`、`curl` 在 macOS 上都自带或由 Homebrew 提供。

## Windows

确认 PowerShell 版本：

```powershell
$PSVersionTable.PSVersion
```

5.1 是 Windows 10/11 自带的，够用；7.x 更好，可以去 `aka.ms/powershell` 装。

安装：

```powershell
powershell -ExecutionPolicy Bypass -File windows\install.ps1
```

做的事：

1. 把两个 `.ps1` 复制到 `%LOCALAPPDATA%\TermuxAI\bin`
2. 生成同名 `.cmd` 启动器，内部用 `-ExecutionPolicy Bypass` 调 PowerShell
3. 把该目录加到**用户级** PATH（不动系统 PATH，不需要管理员）

装完重开一个终端，然后：

```powershell
termuxai
termuxai-harness
```

模型服务用 `llama-server.exe`：

```powershell
llama-server.exe -m model.gguf -c 1024 --port 8080
```

### Windows 上为什么单独一套脚本

bash 的 `jq` 管道和 `eval` 在 Windows 上要额外装环境（Git Bash / WSL），不值得。PowerShell 自带 JSON 处理，`Invoke-Expression` 就是 `eval` 的等价物，黑名单再针对 PowerShell 和 cmd 的危险命令重写一遍。

风险模型没变：命令先打印，按 `y` 才执行。

### Windows 高危黑名单

`Remove-Item -Recurse`、`del /s`、`rd /s`、`format X:`、`diskpart`、`Clear-Disk`、`Initialize-Disk`、`Remove-Partition`、`shutdown`、`Restart-Computer`、`Stop-Computer`、`cipher /w`、`takeown /f`、`reg delete`、`Set-ExecutionPolicy Unrestricted`、`Set-MpPreference ... Disable`。

和 bash 版一样，这是模式匹配，不是沙箱。删除单个文件这类正常操作不在名单里，会正常弹确认。

### 执行策略

如果你不想每次都带 `-ExecutionPolicy Bypass`，`.cmd` 启动器已经替你带了。也可以给当前用户放开：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

这属于修改系统安全设置，自己权衡。

## 环境变量

两个平台完全一致：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `TERMUX_AI_URL` | `http://127.0.0.1:8080/v1/chat/completions` | 推理接口 |
| `TERMUX_AI_MODEL` | 空 | 模型名，OpenAI 兼容后端用得上 |
| `TERMUX_AI_TEMPERATURE` | `0.2` / `0.1` | 采样温度 |
| `TERMUX_AI_MAX_TOKENS` | `512` / `256` | 单次输出上限 |
| `TERMUX_AI_TIMEOUT` | `120` | 超时秒数 |
| `TERMUX_AI_AUTO_RETRY` | `0` | 仅 harness，`1` 跳过确认，危险 |
| `TERMUX_AI_MAX_RETRY` | `2` | 仅 harness，失败重试上限 |

PowerShell 里设置：

```powershell
$env:TERMUX_AI_URL = "http://127.0.0.1:8080/v1/chat/completions"
```

bash 里设置：

```bash
export TERMUX_AI_URL=http://127.0.0.1:8080/v1/chat/completions
```
