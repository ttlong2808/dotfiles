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
import { executeUninstall } from './modules/uninstall';
import {
  scanKeybindings,
  groupByCategory,
  findConflicts,
} from './modules/keybindings';

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
      await runShellCommand('hyprctl', ['reload']);
      return 'Hyprland reloaded';
    })
  );

  ipcMain.handle('shell:reloadWaybar', () =>
    wrap(async () => {
      // Kill existing waybar, then restart
      try {
        await runShellCommand('killall', ['waybar']);
      } catch {
        // waybar might not be running — that's fine
      }
      // Start waybar in background (detached)
      const { spawn } = require('child_process');
      const child = spawn('waybar', [], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return 'Waybar restarted';
    })
  );
}
