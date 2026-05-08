/**
 * Keybinding Scanner — Phase 5
 *
 * Parses Hyprland config files to extract keybinding definitions.
 * Supports:
 * - hyprland.conf: bind, binde, bindm, bindr, bindl syntax
 * - Recursively follows `source = ` includes
 *
 * SAFETY: Read-only. No file modifications.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Types ────────────────────────────────────────────────────────────

export interface Keybinding {
  /** Modifier keys (e.g., "SUPER", "SUPER SHIFT") */
  modifiers: string[];
  /** The key itself (e.g., "Q", "Return", "1") */
  key: string;
  /** Hyprland dispatcher (e.g., "exec", "killactive", "workspace") */
  dispatcher: string;
  /** Dispatcher argument (e.g., "kitty", "1") */
  action: string;
  /** Category for grouping */
  category: string;
  /** Bind type: bind, binde, bindm, etc. */
  bind_type: string;
  /** Which config file this binding was found in */
  source_file: string;
  /** Line number in the source file */
  line_number: number;
  /** Origin set name (from registry, if known) */
  origin_set: string;
}

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_HYPR_DIR = path.join(os.homedir(), '.config', 'hypr');

/**
 * Regex for Hyprland bind syntax:
 * bind[flags] = MODIFIER, KEY, dispatcher, args
 * Examples:
 *   bind = SUPER, Q, killactive,
 *   bind = SUPER, Return, exec, kitty
 *   binde = , XF86AudioRaiseVolume, exec, wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+
 *   bindm = SUPER, mouse:272, movewindow
 */
const BIND_REGEX = /^(bind[elrmnits]*)\s*=\s*(.*)$/i;

/** Map dispatchers to categories */
const CATEGORY_MAP: Record<string, string> = {
  // Window Management
  killactive: 'Window Management',
  closewindow: 'Window Management',
  togglefloating: 'Window Management',
  fullscreen: 'Window Management',
  fakefullscreen: 'Window Management',
  pin: 'Window Management',
  togglesplit: 'Window Management',
  togglegroup: 'Window Management',
  changegroupactive: 'Window Management',
  movewindow: 'Window Management',
  resizeactive: 'Window Management',
  moveactive: 'Window Management',
  swapwindow: 'Window Management',
  centerwindow: 'Window Management',
  focuswindow: 'Window Management',

  // Navigation
  movefocus: 'Navigation',
  cyclenext: 'Navigation',
  focuscurrentorlast: 'Navigation',
  focusurgentorlast: 'Navigation',

  // Workspace
  workspace: 'Workspace',
  movetoworkspace: 'Workspace',
  movetoworkspacesilent: 'Workspace',
  togglespecialworkspace: 'Workspace',

  // Apps / Exec
  exec: 'Applications',

  // Submap
  submap: 'Submap',

  // Misc
  exit: 'System',
  forcerendererreload: 'System',
  dpms: 'System',
  pseudo: 'Layout',
  layoutmsg: 'Layout',

  // Mouse
  resizewindow: 'Mouse',
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Categorize a dispatcher */
function categorize(dispatcher: string): string {
  return CATEGORY_MAP[dispatcher.toLowerCase()] || 'Other';
}

/** Parse modifier string into array */
function parseModifiers(modStr: string): string[] {
  if (!modStr.trim()) return [];
  return modStr
    .split(/\s+/)
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Parse a single bind line's arguments.
 * Format: MODIFIER, KEY, dispatcher, args
 * (comma-separated, but args can contain commas)
 */
function parseBindArgs(argsStr: string): {
  modifiers: string[];
  key: string;
  dispatcher: string;
  action: string;
} | null {
  // Split by comma, but the 4th+ parts are all "action"
  const parts = argsStr.split(',').map((s) => s.trim());

  if (parts.length < 3) return null;

  const modifiers = parseModifiers(parts[0]);
  const key = parts[1].trim();
  const dispatcher = parts[2].trim();
  const action = parts.slice(3).join(',').trim();

  if (!key || !dispatcher) return null;

  return { modifiers, key, dispatcher, action };
}

// ── Scanner ──────────────────────────────────────────────────────────

/**
 * Parse a single Hyprland config file and extract keybindings.
 * Recursively follows `source = ` directives.
 *
 * @param filePath - Path to the config file
 * @param visited - Set of already-visited paths (prevents infinite loops)
 * @param originSet - Name of the dotfile set (for labeling)
 */
function scanFile(
  filePath: string,
  visited: Set<string>,
  originSet: string
): Keybinding[] {
  const resolved = path.resolve(filePath);

  // Prevent infinite recursion
  if (visited.has(resolved)) return [];
  visited.add(resolved);

  if (!fs.existsSync(resolved)) return [];

  let content: string;
  try {
    content = fs.readFileSync(resolved, 'utf-8');
  } catch {
    return [];
  }

  const bindings: Keybinding[] = [];
  const lines = content.split('\n');
  let currentCategory = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Parse category from comment: # [Category] Description
    const categoryMatch = line.match(/^#\s*\[(.*?)\]/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // Skip comments and empty lines (if not a category comment)
    if (!line || line.startsWith('#')) {
      if (!line) currentCategory = ''; // Reset category on empty line
      continue;
    }

    // Handle `source = path` includes
    const sourceMatch = line.match(/^source\s*=\s*(.+)$/i);
    if (sourceMatch) {
      let sourcePath = sourceMatch[1].trim();

      // Expand ~ to home dir
      if (sourcePath.startsWith('~')) {
        sourcePath = path.join(os.homedir(), sourcePath.slice(1));
      }

      // Handle glob patterns (e.g., source = ~/.config/hypr/conf.d/*.conf)
      if (sourcePath.includes('*')) {
        const dir = path.dirname(sourcePath);
        const pattern = path.basename(sourcePath);
        if (fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir);
            const regex = new RegExp(
              '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
            );
            for (const f of files) {
              if (regex.test(f)) {
                bindings.push(...scanFile(path.join(dir, f), visited, originSet));
              }
            }
          } catch {
            // Can't read glob dir — skip
          }
        }
      } else {
        bindings.push(...scanFile(sourcePath, visited, originSet));
      }
      continue;
    }

    // Match bind lines
    const bindMatch = line.match(BIND_REGEX);
    if (!bindMatch) continue;

    const bindType = bindMatch[1].toLowerCase();
    const argsStr = bindMatch[2];
    const parsed = parseBindArgs(argsStr);

    if (!parsed) continue;

    bindings.push({
      modifiers: parsed.modifiers,
      key: parsed.key,
      dispatcher: parsed.dispatcher,
      action: parsed.action,
      category: currentCategory || categorize(parsed.dispatcher),
      bind_type: bindType,
      source_file: resolved,
      line_number: i + 1,
      origin_set: originSet,
    });
  }

  return bindings;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Scan a Hyprland config directory for all keybindings.
 *
 * @param configDir - Directory to scan (default: ~/.config/hypr)
 * @param originSet - Label for the origin set
 */
export function scanKeybindings(
  configDir: string = DEFAULT_HYPR_DIR,
  originSet: string = 'Core'
): Keybinding[] {
  const visited = new Set<string>();
  const mainConf = path.join(configDir, 'hyprland.conf');

  // Start from main config, recursion handles source directives
  const bindings = scanFile(mainConf, visited, originSet);

  // Also scan any .conf files in the directory not yet visited
  if (fs.existsSync(configDir)) {
    try {
      const files = fs.readdirSync(configDir);
      for (const f of files) {
        if (f.endsWith('.conf') && f !== 'hyprland.conf') {
          const fullPath = path.join(configDir, f);
          bindings.push(...scanFile(fullPath, visited, originSet));
        }
      }
    } catch {
      // Permission error — skip
    }
  }

  return bindings;
}

/**
 * Group keybindings by category for display.
 */
export function groupByCategory(
  bindings: Keybinding[]
): Record<string, Keybinding[]> {
  const groups: Record<string, Keybinding[]> = {};

  for (const binding of bindings) {
    if (!groups[binding.category]) {
      groups[binding.category] = [];
    }
    groups[binding.category].push(binding);
  }

  return groups;
}

/**
 * Detect conflicting keybindings (same modifier+key, different action).
 */
export function findConflicts(
  bindings: Keybinding[]
): Array<{ key_combo: string; bindings: Keybinding[] }> {
  const map = new Map<string, Keybinding[]>();

  for (const b of bindings) {
    const combo = [...b.modifiers, b.key].join('+').toUpperCase();
    if (!map.has(combo)) {
      map.set(combo, []);
    }
    map.get(combo)!.push(b);
  }

  return Array.from(map.entries())
    .filter(([, binds]) => binds.length > 1)
    .map(([key_combo, bindings]) => ({ key_combo, bindings }));
}
