# DotMan — UI/UX Design Specification
> Dotfile Manager for Hyprland | Version 1.0

---

## 1. Design Philosophy

### Concept Direction
**"Terminal meets GUI"** — Industrial/utilitarian aesthetic lấy cảm hứng từ terminal emulator và tiling window manager. Người dùng Hyprland quen với giao diện text-dense, keyboard-driven. DotMan phải cảm giác như một công cụ thật sự, không phải một app consumer thông thường.

### Core Principles
- **Density over decoration** — Thông tin quan trọng hơn whitespace thừa
- **Destructive actions luôn có confirmation** — Không bao giờ xóa im lặng
- **State luôn visible** — Người dùng biết hệ thống đang làm gì ở mọi thời điểm
- **Keyboard-first** — Mọi action đều có keyboard shortcut

### Tone
Brutalist/utilitarian. Dark theme duy nhất. Monospace font cho data, sans-serif cho UI. Accent color đơn sắc (xanh lá hoặc xanh cyan — gợi nhớ terminal).

---

## 2. Design Tokens

### Color Palette

```
Background hierarchy:
  --bg-base:        #0d0d0d    /* Nền chính — gần đen */
  --bg-surface:     #141414    /* Card, panel */
  --bg-elevated:    #1c1c1c    /* Hover state, selected row */
  --bg-overlay:     #242424    /* Modal, dropdown */
  --bg-input:       #0a0a0a    /* Input field background */

Border:
  --border-subtle:  #2a2a2a    /* Divider nhẹ */
  --border-default: #3a3a3a    /* Border card, input */
  --border-focus:   #00ff88    /* Focus ring — accent */

Text:
  --text-primary:   #e8e8e8    /* Nội dung chính */
  --text-secondary: #888888    /* Label, metadata */
  --text-muted:     #555555    /* Disabled, placeholder */
  --text-accent:    #00ff88    /* Accent — tên dotfile set đang active */
  --text-code:      #a8d8a8    /* Path, command, hash */

Semantic:
  --color-success:  #00ff88    /* Installed, done */
  --color-warning:  #ffcc00    /* Conflict, caution */
  --color-danger:   #ff4444    /* Uninstall, delete */
  --color-info:     #4488ff    /* Installing, loading */
  --color-neutral:  #666666    /* Not installed */
```

### Typography

```
Font stacks:
  --font-ui:    'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace
  --font-label: 'IBM Plex Sans', 'Inter', sans-serif
  --font-code:  'JetBrains Mono', monospace

Scale (px):
  --text-xs:   11px   /* Timestamp, hash, badge */
  --text-sm:   12px   /* Table cell, metadata */
  --text-base: 13px   /* Default body */
  --text-md:   14px   /* Label, button */
  --text-lg:   16px   /* Section header */
  --text-xl:   20px   /* Page title */
  --text-2xl:  24px   /* Empty state heading */

Weight:
  400 — body
  500 — label, button
  600 — section header
  700 — page title, modal heading
```

### Spacing & Layout

```
Base unit: 4px

--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-6:   24px
--space-8:   32px
--space-12:  48px

Border radius:
  --radius-sm:  2px   /* Tag, badge */
  --radius-md:  4px   /* Button, input, card */
  --radius-lg:  6px   /* Modal, panel */

Sidebar width:    220px (fixed)
Content max-width: 960px (centered trong content area)
Table row height:  40px
Modal width:       560px (default), 720px (large — manifest preview)
```

### Iconography
Sử dụng **Lucide Icons** toàn bộ. Size mặc định: 14px (inline), 16px (button), 20px (sidebar nav).

Key icons mapping:
```
Sidebar nav:
  Installed sets    → Package
  Install new       → PackagePlus
  Keybindings       → Keyboard
  Settings          → Settings2

Actions:
  Install           → Download
  Uninstall         → Trash2
  Update            → RefreshCw
  Preview files     → FileSearch
  Open in terminal  → Terminal
  Copy path         → Copy
  External link     → ExternalLink
  Git source        → Github (hoặc GitBranch)

Status:
  Installed         → CheckCircle2
  Installing        → Loader2 (spin animation)
  Error             → AlertCircle
  Warning           → AlertTriangle
  Backup exists     → Shield

Keybindings:
  Super key         → Command (hoặc custom)
  Search/filter     → Search
  Export            → FileDown
```

---

## 3. Layout Architecture

### Shell Layout (toàn app)

```
┌─────────────────────────────────────────────────────┐
│  TITLEBAR (32px)                                    │
│  [●] [●] [●]   DotMan v1.0        [_] [□] [×]     │
├──────────────┬──────────────────────────────────────│
│              │  TOPBAR (48px)                       │
│  SIDEBAR     │  [Page Title]    [Search]  [Actions] │
│  (220px)     ├──────────────────────────────────────│
│              │                                      │
│  [nav items] │  CONTENT AREA                        │
│              │  (scrollable)                        │
│              │                                      │
│  ──────────  │                                      │
│  [status]    │                                      │
│              │                                      │
├──────────────┴──────────────────────────────────────│
│  STATUSBAR (24px)                                   │
│  [●] Ready   Backup: ~/.config/dotman/backups    v1 │
└─────────────────────────────────────────────────────┘
```

### Sidebar Detail

```
┌────────────────────┐
│  ◈ DotMan          │  ← App logo + name (16px, accent color)
│                    │
│  LIBRARY           │  ← Section label (10px, muted, uppercase)
│  ▸ Installed Sets  │  ← Nav item (active = accent left border 2px)
│    Install New     │
│    Browse Presets  │
│                    │
│  TOOLS             │
│    Keybindings     │
│    Backup Manager  │
│    Settings        │
│                    │
│  ────────────────  │
│  3 sets installed  │  ← Status footer (12px, muted)
│  Last backup: 2h   │
└────────────────────┘
```

**Sidebar nav item states:**
- Default: text-secondary, no background
- Hover: bg-elevated, text-primary
- Active: bg-elevated, text-accent, left border 2px accent

---

## 4. Screen Specifications

---

### Screen 1: Installed Sets

**Route:** `/` hoặc `/library`

#### Topbar
```
[Package] Installed Sets          [🔍 Search sets...]    [+ Install New]
```

#### Filter Bar (dưới topbar)
```
All (3)  |  Active (1)  |  Inactive (2)  |  Has Updates (1)
                                          Sort: [Date Installed ▾]
```

#### Table Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  □  NAME              SOURCE          INSTALLED    STATUS    ACTIONS  │
├──────────────────────────────────────────────────────────────────────│
│  □  prasanthrangan    github.com/...  2d ago       ● Active  [⋯]    │
│     hyprdots          main branch                                     │
├──────────────────────────────────────────────────────────────────────│
│  □  end-4/dots-hypr   github.com/...  1w ago      ● Active  [⋯]    │
│     illogical-impulse                                                 │
├──────────────────────────────────────────────────────────────────────│
│  □  linuxmobile       github.com/...  3w ago      ○ Inactive [⋯]   │
│     hyprland-dots     tag: v2.1                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Column specs:**
| Column | Width | Content |
|--------|-------|---------|
| Checkbox | 32px | Multi-select |
| Name | 240px | Set name (bold) + author (secondary, smaller) |
| Source | 200px | Truncated URL + branch/tag |
| Installed | 100px | Relative time |
| Status | 100px | Badge pill |
| Actions | 80px | `[⋯]` kebab menu |

**Row hover:** bg-elevated, hiện thêm quick action buttons inline

**Status badges:**
```
● Active    — bg: rgba(0,255,136,0.1), text: #00ff88, border: rgba(0,255,136,0.3)
○ Inactive  — bg: rgba(102,102,102,0.1), text: #666, border: #3a3a3a
⚠ Conflict  — bg: rgba(255,204,0,0.1), text: #ffcc00, border: rgba(255,204,0,0.3)
↑ Update    — bg: rgba(68,136,255,0.1), text: #4488ff, border: rgba(68,136,255,0.3)
```

#### Kebab Menu (dropdown khi click [⋯])
```
┌─────────────────────┐
│  📋 View Files       │
│  🔑 View Keybindings │
│  ↑  Check Update    │
│  ────────────────   │
│  🗑  Uninstall...   │  ← text màu danger, có "..." = có confirmation
└─────────────────────┘
```

#### Empty State
```
         [Package icon — 48px, muted]

         No dotfile sets installed

         Browse preset configurations or install from a Git URL.

         [+ Install from URL]    [Browse Presets]
```

---

### Screen 2: Install New

**Route:** `/install`

#### Layout: 2-column (form trái, preview phải)

```
┌──────────────────────────┬───────────────────────────┐
│  INSTALL SOURCE          │  FILE MANIFEST PREVIEW    │
│                          │                           │
│  Source type:            │  (empty until URL parsed) │
│  [Git] [Archive] [Local] │                           │
│                          │                           │
│  Repository URL:         │                           │
│  [________________________]                          │
│                          │                           │
│  Branch / Tag:           │                           │
│  [main              ▾]   │                           │
│                          │                           │
│  Set name (optional):    │                           │
│  [________________________]                          │
│                          │                           │
│  [🔍 Fetch & Preview]    │                           │
│                          │                           │
└──────────────────────────┴───────────────────────────┘
```

#### Sau khi fetch — File Manifest Preview Panel

```
┌─────────────────────────────────────────────────────┐
│  MANIFEST — prasanthrangan/hyprdots                 │
│  47 files will be installed    [⚠ 3 conflicts]      │
│                                                     │
│  STATUS   FILE                        DESTINATION   │
│  ────────────────────────────────────────────────── │
│  ✓ New    hyprland.conf           → ~/.config/hypr/ │
│  ✓ New    waybar/config           → ~/.config/wayb  │
│  ⚠ Exists kitty/kitty.conf       → ~/.config/kitt  │
│           (backup will be created)                  │
│  ✓ New    rofi/config.rasi        → ~/.config/rofi/ │
│  ...                                                │
│                                                     │
│  [Show all 47 files ▾]                              │
│                                                     │
│  ⚠ 3 files will be backed up to:                   │
│    ~/.config/dotman/backups/hyprdots/2025-01-15/    │
│                                                     │
│  [Cancel]                    [✓ Install Now]        │
└─────────────────────────────────────────────────────┘
```

**Conflict row styling:**
- Background: `rgba(255,204,0,0.05)`
- Left border: 2px `#ffcc00`
- Sub-text "(backup will be created)" — text-muted, 11px

#### Progress State (khi đang install)

```
┌─────────────────────────────────────────────────────┐
│  Installing hyprdots...                             │
│                                                     │
│  [████████████████████░░░░░░░░░] 73%               │
│                                                     │
│  ✓ Cloning repository                              │
│  ✓ Backing up 3 existing files                     │
│  ↻ Copying files... (34/47)                        │
│  ○ Updating registry                               │
│  ○ Done                                             │
│                                                     │
│  Current: ~/.config/hypr/hyprland.conf             │
└─────────────────────────────────────────────────────┘
```

Progress bar: height 4px, bg `--bg-elevated`, fill `--color-accent`, border-radius 2px
Log lines: monospace 12px, icon + text, animated check khi done

---

### Screen 3: Keybinding Viewer

**Route:** `/keybindings`

#### Topbar
```
[Keyboard] Keybindings              [🔍 Filter bindings...]    [↓ Export .md]
                                    [Set: All ▾]
```

#### Filter Row
```
All  |  Super  |  Ctrl  |  Alt  |  Apps  |  System  |  Custom
```

#### Table

```
┌──────────────────────────────────────────────────────────────────┐
│  CATEGORY      KEY COMBO                ACTION              SET   │
├──────────────────────────────────────────────────────────────────│
│  ── Window Management ─────────────────────────────────────────  │
│  Window        Super + Q               Kill active window        │
│  Window        Super + F               Toggle fullscreen         │
│  Window        Super + Space           Toggle floating           │
│                                                                  │
│  ── Navigation ────────────────────────────────────────────────  │
│  Workspace     Super + 1               Switch to workspace 1     │
│  Workspace     Super + Shift + 1       Move window → ws 1        │
│                                                                  │
│  ── Applications ──────────────────────────────────────────────  │
│  Launch        Super + Return          Terminal (kitty)          │
│  Launch        Super + R               App launcher (rofi)       │
└──────────────────────────────────────────────────────────────────┘
```

**Key combo rendering:**
Mỗi key là một tag riêng:
```
[Super] + [Q]          → 2 pill tags, màu bg-overlay, border border-default
[Super] + [Shift] + [1] → 3 pill tags
```
Pill tag: `border: 1px solid #3a3a3a`, `border-radius: 3px`, `padding: 1px 6px`, font monospace 11px, text-secondary

**Category row:** background `bg-surface`, text-muted, uppercase 10px, full-width

#### Conflict Indicator
Nếu 2 sets có cùng keybinding:
```
[Super] + [Q]   Kill window   ⚠ Conflict: also in linuxmobile/dots
```

---

### Screen 4: Backup Manager

**Route:** `/backups`

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKUP SESSION         SET           DATE          SIZE  ACTIONS│
├─────────────────────────────────────────────────────────────────│
│  ▸ 2025-01-15 14:32    hyprdots       Jan 15        2.3MB  [⋯] │
│    3 files                                                       │
│  ▸ 2025-01-08 09:15    linuxmobile    Jan 8         800KB  [⋯] │
│    1 file                                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Expanded row (click ▸ để expand):**
```
▾ 2025-01-15 14:32    hyprdots       Jan 15        2.3MB  [⋯]
  ├── kitty.conf      ~/.config/kitty/kitty.conf          [↩ Restore]
  ├── waybar/config   ~/.config/waybar/config             [↩ Restore]
  └── hyprland.conf   ~/.config/hypr/hyprland.conf        [↩ Restore]
```

Kebab menu cho session:
```
┌──────────────────────┐
│  ↩ Restore all files │
│  📁 Open in Files    │
│  ────────────────    │
│  🗑 Delete backup    │
└──────────────────────┘
```

---

## 5. Modal Specifications

### Uninstall Confirmation Modal

```
┌──────────────────────────────────────────────┐
│  Uninstall hyprdots?                     [×] │
├──────────────────────────────────────────────│
│                                              │
│  ⚠  This will remove 47 files from your    │
│     system. A backup will be created first. │
│                                              │
│  Files to remove:                            │
│  ~/.config/hypr/hyprland.conf               │
│  ~/.config/waybar/config                    │
│  ~/.config/kitty/kitty.conf                 │
│  + 44 more files                            │
│                                              │
│  Backup location:                            │
│  ~/.config/dotman/backups/hyprdots/          │
│  2025-01-15_143256/                          │
│                                              │
│  Type the set name to confirm:              │
│  [________________________]                  │
│                                              │
│          [Cancel]    [🗑 Uninstall]          │
└──────────────────────────────────────────────┘
```

**Uninstall button:** disabled màu danger mờ cho đến khi user gõ đúng tên set. Khi đúng: enable full danger color.

---

### Restore Confirmation Modal

```
┌──────────────────────────────────────────────┐
│  Restore from backup?                    [×] │
├──────────────────────────────────────────────│
│                                              │
│  Restore kitty.conf from backup?            │
│                                              │
│  FROM: ~/.config/dotman/backups/hyprdots/   │
│        2025-01-15_143256/kitty.conf          │
│                                              │
│  TO:   ~/.config/kitty/kitty.conf            │
│                                              │
│  ⚠  Current file will be overwritten.      │
│                                              │
│          [Cancel]    [↩ Restore File]        │
└──────────────────────────────────────────────┘
```

---

### Install Progress Modal (full-screen overlay)

Khi install đang chạy, overlay toàn bộ content area (không block sidebar):

```
┌──────────────────────────────────────────────┐
│                                              │
│  Installing hyprdots                         │
│  github.com/prasanthrangan/hyprdots          │
│                                              │
│  [████████████████████████░░░░░░░░] 78%     │
│                                              │
│  Step 2 of 4: Copying files                  │
│                                              │
│  ✓  Repository cloned                       │
│  ✓  3 files backed up                       │
│  ↻  Copying... (37/47)                      │
│     ~/.config/hypr/hyprland.conf             │
│  ○  Writing registry                        │
│  ○  Generating keybinding index             │
│                                              │
│  [▣ Abort]   (this will roll back changes)  │
└──────────────────────────────────────────────┘
```

Abort button: text-muted, border-subtle. Khi click → confirmation: "Abort install and roll back all copied files?"

---

## 6. Component Library

### Button Variants

```
Primary:     bg #00ff88, text #000000, hover: brightness 110%
Secondary:   bg transparent, border #3a3a3a, text primary, hover: bg-elevated
Danger:      bg transparent, border #ff4444, text #ff4444, hover: bg rgba(255,68,68,0.1)
Ghost:       bg transparent, no border, text secondary, hover: text primary
Disabled:    opacity 40%, cursor not-allowed

Size default: height 32px, padding 0 12px, font-size 13px, font-weight 500
Size sm:      height 26px, padding 0 8px, font-size 12px
Size icon:    32×32px, padding 0
```

### Input Field

```
Height: 32px
Background: --bg-input
Border: 1px solid --border-default
Border-radius: --radius-md
Font: monospace 13px
Padding: 0 10px
Placeholder: --text-muted

Focus: border-color --border-focus (accent), outline none, box-shadow 0 0 0 2px rgba(0,255,136,0.15)
Error: border-color --color-danger
```

### Tag / Badge

```
Padding: 2px 6px
Border-radius: --radius-sm
Font: 11px monospace
```

### Table Row

```
Height: 40px
Border-bottom: 1px solid --border-subtle
Hover: background --bg-elevated
Selected: background rgba(0,255,136,0.05), border-left 2px solid --color-success
```

### Notification Toast

Xuất hiện bottom-right, stack lên trên:
```
┌──────────────────────────────────────┐
│  ✓  hyprdots installed successfully  │
│     47 files copied                  │  [×]
└──────────────────────────────────────┘
```
Auto-dismiss sau 4 giây. Slide in từ phải, fade out.

Types: success (green left border), error (red), warning (yellow), info (blue)

---

## 7. States & Interactions

### Loading States

| Element | Loading treatment |
|---------|------------------|
| Table rows | Skeleton rows — animated shimmer, height 40px |
| Manifest preview | Spinner (Loader2 icon, 16px, spin), text "Fetching repository..." |
| Status badge | Replace text với Loader2 spin, 12px |
| Page initial load | Skeleton layout — sidebar items fade, table skeleton |

Shimmer animation: `background: linear-gradient(90deg, #1c1c1c 25%, #242424 50%, #1c1c1c 75%)`, `background-size: 200% 100%`, `animation: shimmer 1.5s infinite`

### Error States

```
┌────────────────────────────────────────────────┐
│  [AlertCircle]  Failed to fetch repository     │
│                                                │
│  Could not connect to github.com               │
│  Check your internet connection and try again. │
│                                                │
│  [Try Again]    [Copy Error Details]           │
└────────────────────────────────────────────────┘
```

### Keyboard Shortcuts (global)

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Navigate → Installed Sets |
| `Ctrl+2` | Navigate → Install New |
| `Ctrl+3` | Navigate → Keybindings |
| `Ctrl+F` | Focus search bar |
| `Ctrl+N` | New install (từ bất kỳ screen) |
| `Escape` | Close modal / clear search |
| `Delete` | Uninstall selected (khi có row được chọn) |

Shortcut hint hiển thị trong kebab menu và tooltips, ví dụ: `Uninstall... Del`

---

## 8. Responsive Considerations

App này là **desktop-only** (minimum width: 900px). Không cần responsive breakpoints.

Window minimum size: `900 × 600px`

Nếu window nhỏ hơn minimum: hiển thị centered message "DotMan requires a minimum window width of 900px."

---

## 9. Motion & Animation

| Element | Animation |
|---------|-----------|
| Page transition | Fade in 150ms ease-out |
| Modal open | Scale 0.96→1.0 + fade, 120ms ease-out |
| Modal close | Scale 1.0→0.96 + fade, 100ms ease-in |
| Sidebar hover | Background transition 100ms |
| Button hover | Color transition 100ms |
| Toast | Slide in from right 200ms, fade out 200ms |
| Progress bar fill | Width transition 300ms ease |
| Row expand (backup) | Max-height transition 200ms ease |
| Spinner | Rotate 1s linear infinite |
| Shimmer skeleton | 1.5s ease-in-out infinite |

**Nguyên tắc:** Không có animation nào vượt quá 300ms. Không dùng bounce hay spring cho UI công cụ.

---

## 10. Accessibility

- Tất cả interactive elements có `:focus-visible` với ring `2px solid #00ff88`
- Table rows có `role="row"`, keyboard navigable bằng arrow keys
- Modals: focus trap, `aria-modal="true"`, close bằng `Escape`
- Confirmation inputs: `aria-label` rõ ràng
- Color không phải là indicator duy nhất — luôn kèm icon hoặc text
- Status badge có `aria-label` đọc được ("Status: Active", "Status: Conflict")

---

## 11. File Structure gợi ý cho implementation

```
src/
├── components/
│   ├── layout/
│   │   ├── Shell.tsx          // App shell (titlebar, sidebar, topbar, statusbar)
│   │   ├── Sidebar.tsx
│   │   └── Statusbar.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Table.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx
│   │   └── KeyCombo.tsx       // Pill tags cho keybinding display
│   ├── dotsets/
│   │   ├── SetTable.tsx       // Screen 1 main table
│   │   ├── SetRow.tsx
│   │   └── SetKebabMenu.tsx
│   ├── install/
│   │   ├── InstallForm.tsx    // Screen 2 left panel
│   │   ├── ManifestPreview.tsx // Screen 2 right panel
│   │   └── InstallProgress.tsx // Progress overlay
│   ├── keybindings/
│   │   ├── KeybindTable.tsx
│   │   └── KeybindRow.tsx
│   └── modals/
│       ├── UninstallModal.tsx
│       ├── RestoreModal.tsx
│       └── AbortModal.tsx
├── pages/
│   ├── Library.tsx
│   ├── InstallNew.tsx
│   ├── Keybindings.tsx
│   └── BackupManager.tsx
└── styles/
    └── tokens.css             // CSS custom properties từ Design Tokens section
```

---

*Document version: 1.0 | Dành cho DotMan — Hyprland Dotfile Manager*
