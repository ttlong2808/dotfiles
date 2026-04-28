/**
 * Backup Module — Phase 2
 *
 * Creates timestamped backups before any destructive file operation.
 * Provides restore capability to undo changes.
 *
 * SAFETY:
 * - NEVER deletes a file without backing it up first
 * - Backups stored at ~/.config/dotman/backups/{set-name}/{timestamp}/
 * - Preserves original directory structure inside backup
 * - All operations wrapped in try/catch
 */

import fs from 'fs';
import path from 'path';
import { PATHS, checksumFile } from './registry';

// ── Types ────────────────────────────────────────────────────────────

export interface BackupEntry {
  /** Original absolute path of the file */
  original_path: string;
  /** Path inside the backup directory */
  backup_path: string;
  /** SHA-256 checksum of the backed-up file */
  checksum: string;
  /** File size in bytes */
  size: number;
}

export interface BackupSession {
  /** Unique session ID (timestamp-based) */
  id: string;
  /** Name of the dotfile set this backup is for */
  set_name: string;
  /** ISO 8601 timestamp of when backup was created */
  created_at: string;
  /** Root directory of this backup session */
  backup_dir: string;
  /** All files in this backup */
  entries: BackupEntry[];
  /** Total size of all backed-up files in bytes */
  total_size: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Generate a timestamp-based ID: 2026-04-28_145500 */
function generateTimestampId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}_${h}${mi}${s}`;
}

/** Get the backup directory for a specific set and timestamp */
function getBackupDir(setName: string, timestampId: string): string {
  const safeName = setName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(PATHS.BACKUP_BASE_DIR, safeName, timestampId);
}

/** Convert an absolute file path to a relative path from home dir */
function toRelativePath(absolutePath: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (absolutePath.startsWith(home)) {
    return absolutePath.slice(home.length + 1); // strip home + separator
  }
  // Fallback: use basename chain
  return absolutePath.replace(/^\/+/, '');
}

// ── Core Operations ──────────────────────────────────────────────────

/**
 * Create a backup of multiple files before a destructive operation.
 *
 * @param setName - Name of the dotfile set (used for directory naming)
 * @param filePaths - Array of absolute file paths to back up
 * @returns BackupSession with details of what was backed up
 */
export async function createBackup(
  setName: string,
  filePaths: string[]
): Promise<BackupSession> {
  const timestampId = generateTimestampId();
  const backupDir = getBackupDir(setName, timestampId);

  // Create backup directory
  try {
    fs.mkdirSync(backupDir, { recursive: true });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Cannot create backup directory ${backupDir}: ${error.message}`);
  }

  const entries: BackupEntry[] = [];
  let totalSize = 0;

  for (const filePath of filePaths) {
    // Skip files that don't exist (nothing to back up)
    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const relativePath = toRelativePath(filePath);
      const destPath = path.join(backupDir, relativePath);

      // Create parent directories inside backup
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      // Copy file to backup location
      fs.copyFileSync(filePath, destPath);

      // Verify the copy
      const stat = fs.statSync(destPath);
      const checksum = await checksumFile(destPath);

      entries.push({
        original_path: filePath,
        backup_path: destPath,
        checksum,
        size: stat.size,
      });

      totalSize += stat.size;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      // If a single file fails, clean up and throw
      // Don't leave partial backups
      try {
        fs.rmSync(backupDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
      throw new Error(`Failed to backup ${filePath}: ${error.message}`);
    }
  }

  const session: BackupSession = {
    id: timestampId,
    set_name: setName,
    created_at: new Date().toISOString(),
    backup_dir: backupDir,
    entries,
    total_size: totalSize,
  };

  // Write session metadata to backup dir
  const metaPath = path.join(backupDir, 'backup-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(session, null, 2), 'utf-8');

  return session;
}

/**
 * Restore a single file from a backup to its original location.
 * The current file at the target will be overwritten.
 */
export async function restoreFile(
  backupFilePath: string,
  targetPath: string
): Promise<void> {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }

  try {
    // Ensure target directory exists
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // Copy backup file to target
    fs.copyFileSync(backupFilePath, targetPath);

    // Verify restore integrity
    const srcChecksum = await checksumFile(backupFilePath);
    const dstChecksum = await checksumFile(targetPath);
    if (srcChecksum !== dstChecksum) {
      throw new Error('Checksum mismatch after restore — file may be corrupted');
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Checksum')) {
      throw err;
    }
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Failed to restore ${backupFilePath} → ${targetPath}: ${error.message}`);
  }
}

/**
 * Restore all files from a backup session to their original locations.
 */
export async function restoreSession(session: BackupSession): Promise<void> {
  for (const entry of session.entries) {
    await restoreFile(entry.backup_path, entry.original_path);
  }
}

/**
 * List all backup sessions (scan backup directory).
 */
export async function listBackups(): Promise<BackupSession[]> {
  const sessions: BackupSession[] = [];

  if (!fs.existsSync(PATHS.BACKUP_BASE_DIR)) {
    return sessions;
  }

  try {
    const setDirs = fs.readdirSync(PATHS.BACKUP_BASE_DIR);

    for (const setDir of setDirs) {
      const setPath = path.join(PATHS.BACKUP_BASE_DIR, setDir);
      if (!fs.statSync(setPath).isDirectory()) continue;

      const timestampDirs = fs.readdirSync(setPath);
      for (const tsDir of timestampDirs) {
        const metaPath = path.join(setPath, tsDir, 'backup-meta.json');
        if (!fs.existsSync(metaPath)) continue;

        try {
          const raw = fs.readFileSync(metaPath, 'utf-8');
          const session = JSON.parse(raw) as BackupSession;
          sessions.push(session);
        } catch {
          // Corrupted metadata — skip this session
        }
      }
    }
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Failed to list backups: ${error.message}`);
  }

  // Sort by date, newest first
  sessions.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sessions;
}

/**
 * Delete a backup session (permanently removes backup files).
 */
export async function deleteBackup(backupDir: string): Promise<void> {
  if (!backupDir.startsWith(PATHS.BACKUP_BASE_DIR)) {
    throw new Error('Refusing to delete outside backup directory');
  }

  if (!fs.existsSync(backupDir)) {
    return; // Already gone
  }

  try {
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Failed to delete backup ${backupDir}: ${error.message}`);
  }
}

/**
 * Get total disk usage of all backups in bytes.
 */
export async function getBackupsTotalSize(): Promise<number> {
  const sessions = await listBackups();
  return sessions.reduce((sum, s) => sum + s.total_size, 0);
}
