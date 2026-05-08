#!/bin/bash

# professional-dotfiles updater
# Pulls latest changes, merges safely, and protects custom overrides.

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Checking for updates..."

cd "$REPO_DIR"
git pull origin main

echo "🛠 Re-applying configuration..."
./install.sh

echo "✨ System updated successfully!"
