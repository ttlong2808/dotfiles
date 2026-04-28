/**
 * Registry Module — Phase 1
 *
 * Manages the dotfile registry at ~/.config/dotman/registry.json
 * Provides atomic read/write with file locking to prevent corruption.
 *
 * SAFETY:
 * - All writes use write-to-temp-then-rename (atomic)
 * - File locking via lockfile prevents concurrent writes
 * - Auto-creates registry directory if missing
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// ── Types ────────────────────────────────────────────────────────────

export interface ManifestEntry {
  /** Absolute path where file was installed */
  path: string;
  /** SHA-256 checksum of the installed file */
  checksum_sha256: string;
  /** Whether a file existed at this path before install */
  original_existed: boolean;
  /** Whether this is a symlink (true) or copy (false) */
  symlinked: boolean;
}

export interface InstalledSet {
  /** Unique identifier (slug generated from name) */
  id: string;
  /** Display name of the dotfile set */
  name: string;
  /** Source URL (git, archive, or local path) */
  source_url: string;
  /** Install method: 'git' | 'archive' | 'local' */
  install_method: 'git' | 'archive' | 'local';
  /** ISO 8601 install date */
  install_date: string;
  /** Directory where backup of replaced files is stored */
  backup_location: string;
  /** Status: 'active' | 'inactive' */
  status: 'active' | 'inactive';
  /** Version or branch/tag */
  version: string;
  /** List of all installed files */
  manifest: ManifestEntry[];
}

export interface RegistryData {
  /** Registry format version */
  schema_version: number;
  /** Timestamp of last modification */
  last_modified: string;
  /** All installed dotfile sets */
  installed_sets: InstalledSet[];
}

// ── Constants ────────────────────────────────────────────────────────

const DOTMAN_DIR = path.join(os.homedir(), '.config', 'dotman');
const REGISTRY_PATH = path.join(DOTMAN_DIR, 'registry.json');
const LOCKFILE_PATH = path.join(DOTMAN_DIR, 'registry.lock');
const BACKUP_BASE_DIR = path.join(DOTMAN_DIR, 'backups');
const SCHEMA_VERSION = 1;

// Lock timeout: 10 seconds max
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_MS = 100;

// ── Helpers ──────────────────────────────────────────────────────────

function createEmptyRegistry(): RegistryData {
  return {
    schema_version: SCHEMA_VERSION,
    last_modified: new Date().toISOString(),
    installed_sets: [],
  };
}

/** Generate a slug-safe ID from a name */
export function generateSetId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const hash = crypto.createHash('sha256').update(name).digest('hex').slice(0, 8);
  return `${slug}-${hash}`;
}

/** Compute SHA-256 checksum of a file */
export async function checksumFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ── File Locking ─────────────────────────────────────────────────────

async function acquireLock(): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < LOCK_TIMEOUT_MS) {
    try {
      // O_CREAT | O_EXCL: fails if file already exists (atomic check-and-create)
      const fd = fs.openSync(LOCKFILE_PATH, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return; // Lock acquired
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EEXIST') {
        // Lock is held — check if it's stale (older than timeout)
        try {
          const stat = fs.statSync(LOCKFILE_PATH);
          if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS) {
            // Stale lock — remove it and retry
            fs.unlinkSync(LOCKFILE_PATH);
            continue;
          }
        } catch {
          // Lock file disappeared between check — retry
        }
        await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
      } else {
        throw new Error(`Failed to acquire registry lock: ${error.message}`);
      }
    }
  }

  throw new Error(`Registry lock timeout after ${LOCK_TIMEOUT_MS}ms`);
}

function releaseLock(): void {
  try {
    fs.unlinkSync(LOCKFILE_PATH);
  } catch {
    // Lock already gone — fine
  }
}

// ── Core Operations ──────────────────────────────────────────────────

/** Ensure the dotman config directory exists */
export function ensureDotmanDir(): void {
  try {
    fs.mkdirSync(DOTMAN_DIR, { recursive: true });
    fs.mkdirSync(BACKUP_BASE_DIR, { recursive: true });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Cannot create dotman directory: ${error.message}`);
  }
}

/** Load the registry. Returns empty registry if file doesn't exist. */
export async function loadRegistry(): Promise<RegistryData> {
  ensureDotmanDir();

  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const data = JSON.parse(raw) as RegistryData;

    // Basic validation
    if (!data.schema_version || !Array.isArray(data.installed_sets)) {
      console.warn('[registry] Invalid registry format, returning empty');
      return createEmptyRegistry();
    }

    return data;
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      // First run — no registry yet
      return createEmptyRegistry();
    }
    throw new Error(`Failed to read registry: ${error.message}`);
  }
}

/** Save the registry atomically (write to temp, then rename). Acquires file lock. */
export async function saveRegistry(data: RegistryData): Promise<void> {
  ensureDotmanDir();
  await acquireLock();

  try {
    data.last_modified = new Date().toISOString();
    const json = JSON.stringify(data, null, 2);
    const tmpPath = `${REGISTRY_PATH}.tmp.${process.pid}`;

    // Write to temp file
    fs.writeFileSync(tmpPath, json, 'utf-8');

    // Atomic rename
    fs.renameSync(tmpPath, REGISTRY_PATH);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Failed to save registry: ${error.message}`);
  } finally {
    releaseLock();
  }
}

// ── CRUD Operations ──────────────────────────────────────────────────

/** Add a new dotfile set to the registry */
export async function addSet(set: InstalledSet): Promise<void> {
  const registry = await loadRegistry();

  // Check for duplicate ID
  if (registry.installed_sets.some((s) => s.id === set.id)) {
    throw new Error(`Set "${set.name}" (${set.id}) already exists in registry`);
  }

  registry.installed_sets.push(set);
  await saveRegistry(registry);
}

/** Remove a dotfile set from the registry by ID */
export async function removeSet(setId: string): Promise<InstalledSet | null> {
  const registry = await loadRegistry();
  const index = registry.installed_sets.findIndex((s) => s.id === setId);

  if (index === -1) {
    return null;
  }

  const [removed] = registry.installed_sets.splice(index, 1);
  await saveRegistry(registry);
  return removed;
}

/** Find a set by ID */
export async function getSet(setId: string): Promise<InstalledSet | null> {
  const registry = await loadRegistry();
  return registry.installed_sets.find((s) => s.id === setId) ?? null;
}

/** Update a set's fields (partial update) */
export async function updateSet(setId: string, updates: Partial<InstalledSet>): Promise<void> {
  const registry = await loadRegistry();
  const set = registry.installed_sets.find((s) => s.id === setId);

  if (!set) {
    throw new Error(`Set ${setId} not found in registry`);
  }

  Object.assign(set, updates);
  await saveRegistry(registry);
}

/** List all installed sets */
export async function listSets(): Promise<InstalledSet[]> {
  const registry = await loadRegistry();
  return registry.installed_sets;
}

// ── Exports for paths ────────────────────────────────────────────────

export const PATHS = {
  DOTMAN_DIR,
  REGISTRY_PATH,
  BACKUP_BASE_DIR,
} as const;
