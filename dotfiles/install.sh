#!/bin/bash

# professional-dotfiles installer
# Distro-aware, automated backups, non-destructive.

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$HOME/.config"
BACKUP_DIR="$HOME/.config/dotman/backups/$(date +%Y%m%d_%H%M%S)"

echo "🚀 Starting professional-dotfiles installation..."

# 1. Distro Detection & Dependency Check
if [ -f /etc/arch-release ]; then
    echo "📦 Detected Arch Linux. Checking dependencies..."
    DEPENDENCIES=(hyprland waybar kitty rofi dunst swww hyprpaper hyprlock matugen)
    for dep in "${DEPENDENCIES[@]}"; do
        if ! pacman -Qs "$dep" > /dev/null; then
            echo "⚠️ Missing: $dep. Please install it with 'sudo pacman -S $dep'"
        fi
    done
elif [ -f /etc/debian_version ]; then
    echo "📦 Detected Debian/Ubuntu. (Limited support for some tools)"
fi

# 2. Backup Function
backup_file() {
    local file=$1
    if [ -e "$file" ]; then
        mkdir -p "$BACKUP_DIR/$(dirname "$file" | sed "s|$HOME/||")"
        cp -r "$file" "$BACKUP_DIR/$(dirname "$file" | sed "s|$HOME/||")/"
        echo "💾 Backed up: $file"
    fi
}

# 3. Installation Logic
install_config() {
    local src="$REPO_DIR/hypr"
    local dest="$CONFIG_DIR/hypr"

    echo "🛠 Installing Hyprland configuration..."
    backup_file "$dest"
    
    mkdir -p "$dest"
    cp -rv "$src/"* "$dest/"
    
    # Ensure custom/ directory exists but don't overwrite if files exist
    mkdir -p "$dest/custom"
    [ ! -f "$dest/custom/general.conf" ] && touch "$dest/custom/general.conf"
    [ ! -f "$dest/custom/keybindings.conf" ] && touch "$dest/custom/keybindings.conf"
}

install_config

echo "✅ Installation complete! Backups stored in: $BACKUP_DIR"
echo "🔄 Reload Hyprland to apply changes."
