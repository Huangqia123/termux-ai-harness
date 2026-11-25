# Model Pack

六个 GGUF 模型，按手机配置分三档，每档配一个中文模型和一个英文模型。全部 Q4_K_M 量化，配合本项目默认的 llama.cpp 服务端参数开箱即用。

## 选型表

| 档位 | 适用设备 | 中文模型 | 英文模型 | 文件体积 | 建议 `-c` |
| --- | --- | --- | --- | --- | --- |
| 低配 | 4GB RAM 级，骁龙 6 系 / 天玑 700 级 | Qwen2.5-0.5B-Instruct | TinyLlama-1.1B-Chat | 491MB / 669MB | 512 |
| 中配 | 6~8GB RAM 级，骁龙 7 系 / 天玑 8000 级 | Qwen2.5-1.5B-Instruct | Llama-3.2-1B-Instruct | 1.12GB / 808MB | 1024 |
| 高配 | 8GB 以上 RAM，骁龙 8 系 / 天玑 9000 级 | Qwen2.5-3B-Instruct | Llama-3.2-3B-Instruct | 2.10GB / 2.02GB | 2048 |

为什么中文用 Qwen、英文用 Llama：Qwen2.5 的中文语料占比高，指令跟随和中文输出稳定性明显优于同尺寸英文模型；英文侧 Llama-3.2 的英文对话质量和指令理解更好。分档按参数量走，量化格式统一 Q4_K_M，在精度和体积之间比较稳。

## 启动命令

低配中文：

```bash
llama-server -m qwen2.5-0.5b-instruct-q4_k_m.gguf -c 512 --port 8080 -t 4
```

中配中文：

```bash
llama-server -m qwen2.5-1.5b-instruct-q4_k_m.gguf -c 1024 --port 8080 -t 6
```

高配中文：

```bash
llama-server -m qwen2.5-3b-instruct-q4_k_m.gguf -c 2048 --port 8080 -t 8
```

英文把文件名换掉即可，比如 `Llama-3.2-1B-Instruct-Q4_K_M.gguf`。

`-t` 是线程数，按设备大核数量设，别超过大核数，超了反而变慢。

## 内存估算

Q4_K_M 大约是每 10 亿参数 0.6~0.7GB 常驻内存，再加上上下文 KV cache：

- 0.5B：约 0.4~0.6GB
- 1.1B / 1B：约 0.8~1.0GB
- 1.5B：约 1.2~1.5GB
- 3B：约 2.2~2.6GB

留出一半以上余量给系统，不然 Android 会直接把 llama-server 杀掉。

## 自己下载

不想从 Release 拉大文件的话，脚本里改档位就行：

```bash
chmod +x download-models.sh
./download-models.sh low-cn     # 或 mid-cn / high-cn / low-en / mid-en / high-en
```

默认走 `hf-mirror.com` 镜像，国内速度比直连 huggingface.co 稳定。

## 上游许可

- Qwen2.5 系列：Apache License 2.0
- TinyLlama：Apache License 2.0
- Llama 3.2 系列：Llama 3.2 Community License，再分发需保留许可文本并标注 Built with Llama

详见 `THIRD-PARTY-NOTICES.md`。
