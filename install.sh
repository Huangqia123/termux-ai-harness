#!/usr/bin/env bash
#
# Installer for Termux AI / Termux AI Harness on Termux, Linux and macOS.
#
# Usage:
#   bash install.sh              # user install: ~/.local/bin (Linux/macOS)
#   bash install.sh --system     # system install: /usr/local/bin (needs sudo)
#
# On Termux the target is always $PREFIX/bin.
# License: MIT
#

set -euo pipefail

SRC_DIR=$(cd "$(dirname "$0")" && pwd)
MODE="${1:-user}"

info() { printf '\033[36m[*]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[!]\033[0m %s\n' "$1"; }
fail() { printf '\033[31m[x]\033[0m %s\n' "$1" >&2; exit 1; }

info "detecting platform"

if [ -n "${PREFIX:-}" ] && [ -d "${PREFIX}/bin" ] && printf '%s' "$PREFIX" | grep -q 'com.termux'; then
    PLATFORM="termux"
    BIN_DIR="$PREFIX/bin"
elif [ "$(uname -s)" = "Darwin" ]; then
    PLATFORM="macos"
    BIN_DIR="$HOME/.local/bin"
elif [ "$(uname -s)" = "Linux" ]; then
    PLATFORM="linux"
    BIN_DIR="$HOME/.local/bin"
else
    fail "unsupported platform: $(uname -s)"
fi

if [ "$MODE" = "--system" ] && [ "$PLATFORM" != "termux" ]; then
    BIN_DIR="/usr/local/bin"
fi

info "platform: $PLATFORM"
info "target:   $BIN_DIR"

info "checking dependencies"
for dep in curl jq; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        if [ "$PLATFORM" = "termux" ]; then
            warn "$dep missing, installing with pkg"
            pkg install -y "$dep"
        else
            fail "$dep missing. Install it first (apt/dnf/pacman/brew install $dep)."
        fi
    fi
done

mkdir -p "$BIN_DIR" 2>/dev/null || true
if [ ! -w "$BIN_DIR" ]; then
    fail "no write permission on $BIN_DIR, run with sudo or use --system"
fi

info "installing binaries"
for f in termuxai termuxai-harness; do
    install -m 755 "$SRC_DIR/bin/$f" "$BIN_DIR/$f"
    info "installed $f"
done

case ":$PATH:" in
    *":$BIN_DIR:"*) info "$BIN_DIR already on PATH" ;;
    *) warn "$BIN_DIR is not on PATH. Add this to your shell profile:"
       printf '    export PATH="%s:$PATH"\n' "$BIN_DIR" ;;
esac

info "done"
printf '\nWindows users: run windows/install.ps1 in PowerShell instead.\n'
printf '\nStart the model server first:\n'
printf '  llama-server -m ./your-model.gguf -c 1024 --port 8080\n\n'
printf 'Then run:\n'
printf '  termuxai            # offline chat\n'
printf '  termuxai-harness    # shell agent\n'
