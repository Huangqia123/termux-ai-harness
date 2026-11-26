#!/usr/bin/env bash
# Linux: start the local llama-server that the web page connects to.
# Prereq: llama-server installed on PATH, GGUF model in ./models or ~/.termux-ai/models.
set -e

MODEL_DIR="${MODEL_DIR:-$HOME/.termux-ai/models}"
mkdir -p "$MODEL_DIR"

if [ -n "$1" ]; then
  MODEL="$1"
else
  MODEL=$(ls "$MODEL_DIR"/*.gguf 2>/dev/null | grep -vi mmproj | head -1)
fi

if [ -z "$MODEL" ] || [ ! -f "$MODEL" ]; then
  echo "未找到 GGUF 模型。把模型放进 $MODEL_DIR，或把模型路径作为参数传给本脚本。"
  exit 1
fi

MP=$(ls "$(dirname "$MODEL")"/mmproj*.gguf 2>/dev/null | head -1)
MPFLAG=""
if [ -n "$MP" ]; then
  MPFLAG="--mmproj \"$MP\" --image-min-tokens 512"
fi

echo "模型: $MODEL"
echo "引擎将监听 127.0.0.1:8080，网页版打开后自动连接。"
exec llama-server -m "$MODEL" $MPFLAG -c 2048 -t 2 \
  --host 127.0.0.1 --port 8080 --cors "*"
