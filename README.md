# ◈ DotMan — Hyprland Dotfile Manager

![DotMan UI](assets/icon.png)

**DotMan** is a professional, visual, and safe dotfile manager specifically designed for Hyprland users. It combines a modern Electron-based GUI with a robust bash-based installation system to provide a seamless experience for managing, switching, and protecting your configurations.

## 🚀 Quick Start

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/ttlong2808/dotfiles.git
   cd dotfiles
   ```

2. **Run the installer:**
   ```bash
   chmod +x dotfiles/install.sh
   ./dotfiles/install.sh
   ```

3. **Launch the Manager:**
   ```bash
   npm install
   npm run dev
   ```

## 🛠 Features

### 1. Modular Configuration
The configurations are split into modular components for easier maintenance:
- `hypr/hyprland.conf`: Main entry point.
- `hypr/conf/`: Core configuration modules (general, decoration, keybindings).
- `hypr/custom/`: User-specific overrides (ignored by git to prevent merge conflicts).

### 2. Professional Installation System
- **Automated Backups:** Every installation creates a timestamped backup in `~/.config/dotman/backups/`.
- **Distro-Aware:** Detects your Linux distribution and checks for required dependencies.
- **Non-Destructive:** Protects your custom settings using the `.dotignore` mechanism.

### 3. Keybinding Cheatsheet
DotMan automatically scans your `hyprland.conf` and generates a searchable keybinding cheatsheet with category support using a specialized syntax:
```bash
# [Category] Description
bind = SUPER, Q, killactive,
```

### 4. Backup & Restore
Easily snapshot your entire system configuration or individual sets and restore them with a single click if something goes wrong.

## 📂 Repository Structure

```
.
├── dotfiles/                # Core Linux configurations
│   ├── hypr/                # Hyprland specific configs
│   │   ├── conf/            # Modular settings
│   │   ├── custom/          # User overrides
│   │   └── hyprland.conf    # Main entry
│   ├── install.sh           # Professional installer
│   ├── update.sh            # Safe updater
│   └── .dotignore           # Protection rules
├── src/                     # Electron Frontend (React)
├── electron/                # Electron Backend (TypeScript)
└── ...
```

## 🤝 Contributing
Feel free to submit issues or pull requests. For custom themes, please place them in a subfolder and follow the modular structure.

---
*Created with ♥ for the Hyprland Community.*
