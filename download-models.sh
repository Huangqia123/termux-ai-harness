#!/usr/bin/env bash
#
# Download GGUF model packs for Termux AI Harness.
#
# Usage:
#   ./download-models.sh list
#   ./download-models.sh low-cn
#   ./download-models.sh mid-en
#   ./download-models.sh all-cn
#
# License: MIT (this script only; models keep their upstream licenses)
#

set -uo pipefail

MIRROR="${MODEL_MIRROR:-https://hf-mirror.com}"
DEST="${MODEL_DIR:-$HOME/models}"
TARGET="${1:-list}"

declare -A NAME
declare -A URL
declare -A FILENAME

NAME[low-cn]="qwen2.5-0.5b-instruct-q4_k_m.gguf (491MB, Qwen2.5-0.5B, Apache-2.0)"
URL[low-cn]="$MIRROR/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
FILENAME[low-cn]="qwen2.5-0.5b-instruct-q4_k_m.gguf"

NAME[mid-cn]="qwen2.5-1.5b-instruct-q4_k_m.gguf (1.12GB, Qwen2.5-1.5B, Apache-2.0)"
URL[mid-cn]="$MIRROR/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
FILENAME[mid-cn]="qwen2.5-1.5b-instruct-q4_k_m.gguf"

NAME[high-cn]="qwen2.5-3b-instruct-q4_k_m.gguf (2.10GB, Qwen2.5-3B, Apache-2.0)"
URL[high-cn]="$MIRROR/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf"
FILENAME[high-cn]="qwen2.5-3b-instruct-q4_k_m.gguf"

NAME[low-en]="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf (669MB, TinyLlama-1.1B, Apache-2.0)"
URL[low-en]="$MIRROR/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
FILENAME[low-en]="tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"

NAME[mid-en]="Llama-3.2-1B-Instruct-Q4_K_M.gguf (808MB, Llama-3.2-1B, Llama 3.2 Community License)"
URL[mid-en]="$MIRROR/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf"
FILENAME[mid-en]="Llama-3.2-1B-Instruct-Q4_K_M.gguf"

NAME[high-en]="Llama-3.2-3B-Instruct-Q4_K_M.gguf (2.02GB, Llama-3.2-3B, Llama 3.2 Community License)"
URL[high-en]="$MIRROR/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
FILENAME[high-en]="Llama-3.2-3B-Instruct-Q4_K_M.gguf"

usage() {
    printf 'usage: %s <target>\n\n' "$(basename "$0")"
    printf 'targets:\n'
    printf '  list              show the catalog\n'
    printf '  low-cn mid-cn high-cn   chinese models by device tier\n'
    printf '  low-en mid-en high-en   english models by device tier\n'
    printf '  all-cn all-en all       every chinese / english / all models\n'
}

list_models() {
    printf '%-9s %s\n' "low-cn"  "${NAME[low-cn]}"
    printf '%-9s %s\n' "mid-cn"  "${NAME[mid-cn]}"
    printf '%-9s %s\n' "high-cn" "${NAME[high-cn]}"
    printf '%-9s %s\n' "low-en"  "${NAME[low-en]}"
    printf '%-9s %s\n' "mid-en"  "${NAME[mid-en]}"
    printf '%-9s %s\n' "high-en" "${NAME[high-en]}"
}

fetch() {
    local key="$1"
    local file="${FILENAME[$key]}"
    local out="$DEST/$file"

    if [ -f "$out" ]; then
        printf 'skip (exists): %s\n' "$file"
        return 0
    fi

    printf 'downloading %s\n' "${NAME[$key]}"
    curl -L --retry 3 --retry-delay 5 -C - "${URL[$key]}" -o "$out"
    local rc=$?
    if [ $rc -ne 0 ]; then
        printf 'failed: %s\n' "$file" >&2
        rm -f "$out"
        return 1
    fi
    printf 'saved: %s\n' "$out"
}

if [ "$TARGET" = "list" ]; then
    list_models
    exit 0
fi

command -v curl >/dev/null 2>&1 || { printf 'curl not found\n' >&2; exit 1; }
mkdir -p "$DEST"

case "$TARGET" in
    low-cn|mid-cn|high-cn|low-en|mid-en|high-en)
        fetch "$TARGET"
        ;;
    all-cn)
        for k in low-cn mid-cn high-cn; do fetch "$k"; done
        ;;
    all-en)
        for k in low-en mid-en high-en; do fetch "$k"; done
        ;;
    all)
        for k in low-cn mid-cn high-cn low-en mid-en high-en; do fetch "$k"; done
        ;;
    *)
        usage
        exit 1
        ;;
esac
