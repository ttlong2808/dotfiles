/**
 * Uninstall Module — Phase 4
 *
 * Safely removes a dotfile set:
 * 1. Read manifest from registry
 * 2. Backup every file being removed
 * 3. Delete only files matching manifest checksums
 * 4. Restore original files from install-time backup (if they existed)
 * 5. Update registry
 *
 * SAFETY:
 * - NEVER deletes without backup
 * - NEVER deletes a file if its checksum doesn't match (was modified by user)
 * - Files outside approved directories require explicit confirmation
 * - Atomic: if any step fails, previous backups remain untouched
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getSet,
  removeSet,
  checksumFile,
  type InstalledSet,
  type ManifestEntry,
} from './registry';
import { createBackup, restoreFile } from './backup';

// ── Types ────────────────────────────────────────────────────────────

export interface UninstallResult {
  /** Set that was uninstalled */
  set_name: string;
  /** Number of files removed */
  files_removed: number;
  /** Number of files restored from original backup */
  files_restored: number;
  /** Files skipped (checksum mismatch — user modified them) */
  files_skipped: string[];
  /** Backup location for this uninstall operation */
  uninstall_backup_dir: string;
}

export interface UninstallProgress {
  step: string;
  current: number;
  total: number;
  detail: string;
}

// ── Constants ────────────────────────────────────────────────────────

const APPROVED_DIRS = [
  path.join(os.homedir(), '.config'),
  path.join(os.homedir(), '.local', 'share'),
  path.join(os.homedir(), '.local', 'bin'),
  path.join(os.homedir(), '.cache'),
];

// ── Helpers ──────────────────────────────────────────────────────────

function isApprovedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return APPROVED_DIRS.some((dir) => resolved.startsWith(dir));
}

/** Remove empty parent directories up to home dir */
function cleanEmptyParents(filePath: string): void {
  const home = os.homedir();
  let dir = path.dirname(filePath);

  while (dir !== home && dir.startsWith(home)) {
    try {
      const contents = fs.readdirSync(dir);
      if (contents.length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else {
        break; // Not empty, stop
      }
    } catch {
      break;
    }
  }
}

// ── Core Uninstall ───────────────────────────────────────────────────

/**
 * Execute safe uninstall of a dotfile set.
 *
 * @param setId - Registry ID of the set to uninstall
 * @param onProgress - Optional progress callback
 * @returns UninstallResult with details
 */
export async function executeUninstall(
  setId: string,
  onProgress?: (progress: UninstallProgress) => void
): Promise<UninstallResult> {
  // Step 1: Load the set from registry
  const set = await getSet(setId);
  if (!set) {
    throw new Error(`Dotfile set "${setId}" not found in registry`);
  }

  const totalFiles = set.manifest.length;
  const filesSkipped: string[] = [];
  let filesRemoved = 0;
  let filesRestored = 0;

  // Step 2: Validate all paths are in approved directories
  const unapproved = set.manifest.filter((e) => !isApprovedPath(e.path));
  if (unapproved.length > 0) {
    throw new Error(
      `Uninstall blocked: ${unapproved.length} files are outside approved directories. ` +
      `Manual removal required for: ${unapproved.map((e) => e.path).join(', ')}`
    );
  }

  // Step 3: Backup all files before removal
  onProgress?.({
    step: 'Creating safety backup',
    current: 0,
    total: totalFiles,
    detail: `Backing up ${totalFiles} files before removal`,
  });

  const existingFiles = set.manifest
    .map((e) => e.path)
    .filter((p) => fs.existsSync(p));

  const uninstallBackup = await createBackup(
    `uninstall_${set.name}`,
    existingFiles
  );

  // Step 4: Remove each file from the manifest
  for (let i = 0; i < set.manifest.length; i++) {
    const entry = set.manifest[i];

    onProgress?.({
      step: 'Removing files',
      current: i + 1,
      total: totalFiles,
      detail: entry.path,
    });

    if (!fs.existsSync(entry.path)) {
      // Already gone — skip
      continue;
    }

    try {
      // Safety check: verify checksum matches what we installed
      const currentChecksum = await checksumFile(entry.path);
      if (currentChecksum !== entry.checksum_sha256) {
        // File was modified by user — DON'T delete it
        console.warn(
          `[uninstall] Skipping ${entry.path}: checksum mismatch ` +
          `(installed: ${entry.checksum_sha256.slice(0, 12)}..., ` +
          `current: ${currentChecksum.slice(0, 12)}...)`
        );
        filesSkipped.push(entry.path);
        continue;
      }

      // Safe to delete
      fs.unlinkSync(entry.path);
      filesRemoved++;

      // Clean up empty parent dirs
      cleanEmptyParents(entry.path);
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      console.error(`[uninstall] Failed to remove ${entry.path}: ${error.message}`);
      filesSkipped.push(entry.path);
    }
  }

  // Step 5: Restore original files (from install-time backup)
  if (set.backup_location && fs.existsSync(set.backup_location)) {
    onProgress?.({
      step: 'Restoring original files',
      current: totalFiles,
      total: totalFiles,
      detail: 'Restoring files that existed before installation',
    });

    const originalEntries = set.manifest.filter((e) => e.original_existed);

    for (const entry of originalEntries) {
      // Find the backed-up version in the install-time backup
      const metaPath = path.join(set.backup_location, 'backup-meta.json');
      if (!fs.existsSync(metaPath)) continue;

      try {
        const metaRaw = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaRaw);
        const backupEntry = meta.entries?.find(
          (e: { original_path: string }) => e.original_path === entry.path
        );

        if (backupEntry && fs.existsSync(backupEntry.backup_path)) {
          await restoreFile(backupEntry.backup_path, entry.path);
          filesRestored++;
        }
      } catch {
        console.warn(`[uninstall] Could not restore original for ${entry.path}`);
      }
    }
  }

  // Step 6: Remove set from registry
  onProgress?.({
    step: 'Updating registry',
    current: totalFiles,
    total: totalFiles,
    detail: 'Removing from registry',
  });

  await removeSet(setId);

  return {
    set_name: set.name,
    files_removed: filesRemoved,
    files_restored: filesRestored,
    files_skipped: filesSkipped,
    uninstall_backup_dir: uninstallBackup.backup_dir,
  };
}
