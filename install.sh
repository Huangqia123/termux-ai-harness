#!/usr/bin/env bash
#
# Installer for Termux AI / Termux AI Harness.
#
# Usage: bash install.sh
# License: MIT
#

set -euo pipefail

SRC_DIR=$(cd "$(dirname "$0")" && pwd)
BIN_DIR="${PREFIX:-/usr/local}/bin"

info() { printf '\033[36m[*]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[!]\033[0m %s\n' "$1"; }
fail() { printf '\033[31m[x]\033[0m %s\n' "$1" >&2; exit 1; }

info "checking dependencies"

for dep in curl jq; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        if command -v pkg >/dev/null 2>&1; then
            warn "$dep missing, installing with pkg"
            pkg install -y "$dep"
        else
            fail "$dep missing. Install it first."
        fi
    fi
done

info "installing into $BIN_DIR"

if [ ! -d "$BIN_DIR" ]; then
    fail "target directory $BIN_DIR does not exist"
fi

if [ ! -w "$BIN_DIR" ]; then
    fail "no write permission on $BIN_DIR, try running with sudo"
fi

for f in termuxai termuxai-harness; do
    install -m 755 "$SRC_DIR/bin/$f" "$BIN_DIR/$f"
    info "installed $f"
done

info "done"
printf '\nStart the model server first:\n'
printf '  llama-server -m ./your-model.gguf -c 1024 --port 8080\n\n'
printf 'Then run:\n'
printf '  termuxai            # offline chat\n'
printf '  termuxai-harness    # shell agent\n'
