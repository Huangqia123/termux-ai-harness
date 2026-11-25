# Third-Party Notices

本项目本体（`termuxai`、`termuxai-harness`、安装与下载脚本、文档）以 MIT 许可发布，见根目录 `LICENSE`。

下列模型权重为第三方作品，版权归各自作者所有，本项目仅做原样分发（GGUF 量化文件未做任何修改）。各模型仍受其上游许可约束，使用前请阅读对应许可全文。

## Qwen2.5 系列（中文档位）

- 模型：Qwen2.5-0.5B-Instruct / Qwen2.5-1.5B-Instruct / Qwen2.5-3B-Instruct
- 作者：Alibaba Qwen Team
- 许可：Apache License 2.0
- 来源：https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF 、https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF 、https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF
- 许可全文：`licenses/Qwen2.5-LICENSE.txt`（与 `licenses/Apache-2.0.txt` 同文）

Apache-2.0 义务摘要：保留版权与许可声明、标明修改（本项目未修改权重）、保留 NOTICE 文件（若上游提供）。

## TinyLlama（低配英文）

- 模型：TinyLlama-1.1B-Chat-v1.0，Q4_K_M 量化
- 作者：TinyLlama Project
- 量化提供者：TheBloke
- 许可：Apache License 2.0
- 来源：https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF
- 许可全文：`licenses/Apache-2.0.txt`

## Llama 3.2 系列（中配 / 高配英文）

- 模型：Llama-3.2-1B-Instruct / Llama-3.2-3B-Instruct，Q4_K_M 量化
- 作者：Meta Platforms, Inc.
- 量化提供者：bartowski
- 许可：Llama 3.2 Community License Agreement
- 来源：https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF 、https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF
- 许可全文：`licenses/Llama-3.2-LICENSE.txt`

Llama 3.2 Community License 关键义务：

1. 再分发时必须随附本许可协议副本（已附于 `licenses/`）。
2. 必须在显著位置标注 **Built with Llama**。
3. 衍生模型名称中若使用 "Llama"，须保留 "Llama" 字样并附带 "Built with Llama" 标识。
4. 不得使用 Meta 的名称、标识或商标暗示官方背书。
5. 月度活跃用户超过 7 亿的商业部署需另行向 Meta 申请许可。

本项目的脚本以 "Built with Llama" 之外的方式与模型解耦——脚本本身不含任何模型权重，模型由用户自行下载或从本仓库 Release 获取。

## 免责

模型输出由模型自身生成，本项目不提供任何关于输出准确性、合法性或适用性的担保。使用本地模型处理数据时，请自行评估隐私与合规风险。
