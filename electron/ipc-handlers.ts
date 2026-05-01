/**
 * IPC Handlers — registers all main-process handlers for renderer communication.
 * Each handler maps to a channel exposed in preload.ts.
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import {
  loadRegistry,
  saveRegistry,
  type RegistryData,
} from './modules/registry';
import {
  getSystemInfo,
  isHyprlandRunning,
  detectDistro,
} from './modules/system';
import {
  createBackup,
  restoreFile,
  listBackups,
  deleteBackup,
} from './modules/backup';
import {
  fetchAndPreview,
  executeInstall,
  type InstallConfig,
} from './modules/install';
import { checkCompatibility } from './modules/compatibility';
import { executeUninstall } from './modules/uninstall';
import {
  scanKeybindings,
  groupByCategory,
  findConflicts,
} from './modules/keybindings';
import {
  checkForUpdates,
  downloadUpdate,
} from './modules/updater';

// ── Helper ─────────────────────────────────────────────────────────

function wrap<T>(fn: () => Promise<T>): Promise<{ ok: boolean; data?: T; error?: string }> {
  return fn()
    .then((data) => ({ ok: true as const, data }))
    .catch((err: Error) => ({ ok: false as const, error: err.message }));
}

function wrapSync<T>(fn: () => T): { ok: boolean; data?: T; error?: string } {
  try {
    return { ok: true, data: fn() };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

function runShellCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[shell] Running: ${cmd} ${args.join(' ')}`);
    execFile(cmd, args, { timeout: 10_000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[shell] Failed: ${error.message}, stderr: ${stderr}`);
        reject(new Error(`${cmd} failed: ${error.message}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ── Registration ───────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  // ── Registry ───────────────────────────────────────────────────
  ipcMain.handle('registry:load', () => wrap(() => loadRegistry()));

  ipcMain.handle('registry:save', (_event, data: RegistryData) =>
    wrap(() => saveRegistry(data))
  );

  // ── System Detection ───────────────────────────────────────────
  ipcMain.handle('system:getInfo', () => wrap(() => getSystemInfo()));

  ipcMain.handle('system:isHyprlandRunning', () =>
    wrap(() => isHyprlandRunning())
  );

  ipcMain.handle('system:getDistro', () =>
    wrapSync(() => detectDistro())
  );

  // ── Backup ─────────────────────────────────────────────────────
  ipcMain.handle('backup:create', (_event, setId: string, files: string[]) =>
    wrap(() => createBackup(setId, files))
  );

  ipcMain.handle('backup:restore', (_event, backupPath: string, targetPath: string) =>
    wrap(() => restoreFile(backupPath, targetPath))
  );

  ipcMain.handle('backup:list', () => wrap(() => listBackups()));

  ipcMain.handle('backup:delete', (_event, backupDir: string) => 
    wrap(() => deleteBackup(backupDir))
  );

  // ── Install ────────────────────────────────────────────────────
  ipcMain.handle(
    'install:fetchManifest',
    (_event, url: string, method: string, branch?: string, targetBase?: string) =>
      wrap(() =>
        fetchAndPreview(url, method as 'git' | 'archive' | 'local', branch, targetBase)
      )
  );

  ipcMain.handle('install:execute', (_event, config: InstallConfig) =>
    wrap(() => executeInstall(config))
  );

  ipcMain.handle('install:checkCompatibility', (_event, conflictCount: number) =>
    wrap(async () => {
      const os = require('os');
      const path = require('path');
      const stagedDir = path.join(os.homedir(), '.cache', 'dotman', 'staging', 'repo');
      return checkCompatibility(stagedDir, conflictCount);
    })
  );

  // ── Uninstall ──────────────────────────────────────────────────
  ipcMain.handle('uninstall:execute', (_event, setId: string) =>
    wrap(() => executeUninstall(setId))
  );

  // ── Keybindings ────────────────────────────────────────────────
  ipcMain.handle('keybindings:scan', (_event, configDir?: string) => {
    return wrapSync(() => {
      const bindings = scanKeybindings(configDir);
      const grouped = groupByCategory(bindings);
      const conflicts = findConflicts(bindings);
      return { bindings, grouped, conflicts };
    });
  });

  // ── Shell Commands ─────────────────────────────────────────────
  ipcMain.handle('shell:reloadHyprland', () =>
    wrap(async () => {
      try {
        await runShellCommand('which', ['hyprctl']);
        await runShellCommand('hyprctl', ['reload']);
        return 'Hyprland reloaded';
      } catch {
        console.warn('[shell] hyprctl not found or failed — skipping Hyprland reload');
        return 'Hyprland not available — skipped';
      }
    })
  );

  ipcMain.handle('shell:reloadWaybar', () =>
    wrap(async () => {
      try {
        // Check if waybar exists first
        await runShellCommand('which', ['waybar']);
      } catch {
        console.warn('[shell] waybar not found — skipping Waybar reload');
        return 'Waybar not installed — skipped';
      }

      // Kill existing waybar (may not be running)
      try {
        await runShellCommand('killall', ['waybar']);
      } catch {
        // waybar might not be running — that's fine
      }

      // Start waybar in background (detached)
      try {
        const { spawn } = require('child_process');
        const child = spawn('waybar', [], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        return 'Waybar restarted';
      } catch (err) {
        console.warn('[shell] Failed to start waybar:', err);
        return 'Waybar restart failed — skipped';
      }
    })
  );

  // ── Quick Backup (backup current config for a set) ─────────────
  ipcMain.handle('backup:quickSave', (_event, setId: string) =>
    wrap(async () => {
      const registry = await loadRegistry();
      const set = registry.installed_sets.find(s => s.id === setId);
      if (!set) throw new Error(`Set ${setId} not found in registry`);
      const filePaths = set.manifest.map(m => m.path);
      const session = await createBackup(set.name, filePaths);
      return session;
    })
  );

  // ── System-wide Backup ─────────────────────────────────────────
  ipcMain.handle('backup:system', () =>
    wrap(async () => {
      const os = require('os');
      const fs = require('fs');
      const path = require('path');
      const home = os.homedir();
      const configDirs = [
        path.join(home, '.config', 'hypr'),
        path.join(home, '.config', 'waybar'),
        path.join(home, '.config', 'kitty'),
        path.join(home, '.config', 'rofi'),
        path.join(home, '.config', 'swaync'),
        path.join(home, '.config', 'swayosd'),
        path.join(home, '.config', 'fastfetch'),
        path.join(home, '.config', 'nvim'),
      ];

      // Collect all files from existing config directories
      const allFiles: string[] = [];
      const walkSync = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkSync(full);
          else if (entry.isFile()) allFiles.push(full);
        }
      };
      for (const dir of configDirs) walkSync(dir);

      if (allFiles.length === 0) throw new Error('No config files found to backup');
      const session = await createBackup('system-snapshot', allFiles);
      return { ...session, file_count: allFiles.length };
    })
  );

  // ── Update ─────────────────────────────────────────────────────
  ipcMain.handle('update:check', () => wrap(() => checkForUpdates()));

  ipcMain.handle('update:download', (_event, url: string, publishedAt: string) =>
    wrap(() => downloadUpdate(url, publishedAt))
  );
}
