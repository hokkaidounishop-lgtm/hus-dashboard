#!/usr/bin/env bash
# One-shot bootstrap: venv + install + run Drive setup
# Usage: bash scripts/setup_hus_drive.sh

set -euo pipefail
cd "$(dirname "$0")/.."

VENV_DIR=".venv-drive"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating venv at $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

echo "Installing Google API libs + anthropic SDK (quiet)..."
pip install -q --upgrade pip
pip install -q google-api-python-client google-auth-oauthlib anthropic

echo
echo "=========================================="
echo "Running HUS Drive folder setup..."
echo "=========================================="
python3 scripts/setup_hus_drive.py
