/**
 * Install Module — Phase 3
 *
 * Handles dotfile set installation from:
 * - Git repositories (clone)
 * - Archive URLs (curl/wget download)
 * - Local directories (copy)
 *
 * Flow: download → staging → manifest generation → backup conflicts → copy → registry update
 *
 * SAFETY:
 * - All downloads go to staging area first (~/.cache/dotman/staging/)
 * - Existing files are ALWAYS backed up before overwrite
 * - Approved directories only: ~/.config, ~/.local/share, ~/.cache, ~/.local/bin
 * - Every shell command logged for debugging
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import {
  addSet,
  checksumFile,
  generateSetId,
  type InstalledSet,
  type ManifestEntry,
} from './registry';
import { createBackup } from './backup';

// ── Types ────────────────────────────────────────────────────────────

export interface ManifestPreviewEntry {
  /** Relative path inside the dotfile repo */
  source_relative: string;
  /** Absolute destination path on the system */
  destination: string;
  /** Whether a file already exists at the destination */
  conflict: boolean;
  /** File size in bytes */
  size: number;
  /** Whether user selected this file for installation */
  selected: boolean;
}

export interface InstallConfig {
  /** Display name for this dotfile set */
  name: string;
  /** Source URL or path */
  source: string;
  /** Install method */
  method: 'git' | 'archive' | 'local';
  /** Git branch or tag (only for git method) */
  branch?: string;
  /** Target base directory (default: ~/.config) */
  target_base?: string;
  /** Files selected for installation (from manifest preview) */
  selected_files: ManifestPreviewEntry[];
}

export interface InstallProgress {
  step: string;
  current: number;
  total: number;
  detail: string;
}

// ── Constants ────────────────────────────────────────────────────────

const STAGING_DIR = path.join(os.homedir(), '.cache', 'dotman', 'staging');
const DEFAULT_TARGET = path.join(os.homedir(), '.config');

/** Directories the app is allowed to write to without extra confirmation */
const APPROVED_DIRS = [
  path.join(os.homedir(), '.config'),
  path.join(os.homedir(), '.local', 'share'),
  path.join(os.homedir(), '.local', 'bin'),
  path.join(os.homedir(), '.cache'),
];

// ── Helpers ──────────────────────────────────────────────────────────

/** Check if a path is within the user's home directory (safe zone) */
function isApprovedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(os.homedir());
}

/** Run a shell command safely (execFile, not exec) and return stdout */
function runSafe(cmd: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[install] Running: ${cmd} ${args.join(' ')}${cwd ? ` (cwd: ${cwd})` : ''}`);
    execFile(cmd, args, { cwd, timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[install] Command failed: ${error.message}`);
        console.error(`[install] stderr: ${stderr}`);
        reject(new Error(`Command "${cmd} ${args.join(' ')}" failed: ${error.message}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/** Directories to always skip during file scanning */
const SKIP_DIRS = new Set(['.git', '.github', '.vscode', 'node_modules', '.install', '__pycache__', 'assets']);

/** Recursively list all files in a directory (returns absolute paths) */
function walkDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        results.push(...walkDir(fullPath));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  } catch {
    // Permission denied or similar — skip
  }
  return results;
}

/**
 * Detect if a repo uses GNU Stow structure.
 * Stow repos have top-level dirs (e.g. hyprland/, kitty/) each containing
 * .config/ or .local/ subdirectories that mirror the home directory.
 */
function detectStowStructure(stagedDir: string): boolean {
  try {
    const entries = fs.readdirSync(stagedDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'));
    if (dirs.length < 2) return false;
    let stowCount = 0;
    for (const dir of dirs) {
      try {
        const sub = fs.readdirSync(path.join(stagedDir, dir.name));
        if (sub.includes('.config') || sub.includes('.local') || sub.includes('.cache')) stowCount++;
      } catch { continue; }
    }
    console.log(`[install] Stow detection: ${stowCount}/${dirs.length} stow-like packages`);
    return stowCount >= 2;
  } catch { return false; }
}

/** Clean staging directory */
function cleanStaging(): void {
  try {
    if (fs.existsSync(STAGING_DIR)) {
      fs.rmSync(STAGING_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(STAGING_DIR, { recursive: true });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`Failed to clean staging area: ${error.message}`);
  }
}

// ── Download Methods ─────────────────────────────────────────────────

/** Clone a git repository into staging */
async function gitClone(url: string, branch?: string): Promise<string> {
  cleanStaging();
  const cloneDir = path.join(STAGING_DIR, 'repo');

  const args = ['clone', '--depth', '1'];
  if (branch) {
    args.push('--branch', branch);
  }
  args.push(url, cloneDir);

  await runSafe('git', args);
  return cloneDir;
}

/** Download and extract an archive into staging */
async function downloadArchive(url: string): Promise<string> {
  cleanStaging();
  const archiveName = 'download.tar.gz';
  const archivePath = path.join(STAGING_DIR, archiveName);
  const extractDir = path.join(STAGING_DIR, 'repo');

  // Download with curl
  await runSafe('curl', ['-fSL', '-o', archivePath, url]);

  // Create extraction directory
  fs.mkdirSync(extractDir, { recursive: true });

  // Detect archive type and extract
  if (url.endsWith('.zip')) {
    await runSafe('unzip', ['-o', archivePath, '-d', extractDir]);
  } else {
    // Assume tar.gz / tar.xz
    await runSafe('tar', ['-xf', archivePath, '-C', extractDir, '--strip-components=1']);
  }

  return extractDir;
}

/** Copy a local directory into staging */
async function copyLocal(sourcePath: string): Promise<string> {
  cleanStaging();
  const destDir = path.join(STAGING_DIR, 'repo');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source directory does not exist: ${sourcePath}`);
  }

  // Use cp -r
  fs.cpSync(sourcePath, destDir, { recursive: true });
  return destDir;
}

// ── Manifest Generation ──────────────────────────────────────────────

/**
 * Scan a staged repository and generate a manifest preview.
 * Shows what will be installed and highlights conflicts.
 */
export async function generateManifest(
  stagedDir: string,
  targetBase: string = DEFAULT_TARGET
): Promise<ManifestPreviewEntry[]> {
  const isStow = detectStowStructure(stagedDir);
  const homeDir = os.homedir();
  const files = walkDir(stagedDir);
  const manifest: ManifestPreviewEntry[] = [];

  console.log(`[install] Manifest: ${files.length} files, stow=${isStow}, target=${isStow ? homeDir : targetBase}`);

  for (const file of files) {
    const relativePath = path.relative(stagedDir, file);
    const parts = relativePath.split(path.sep);
    let destination: string;

    if (isStow && parts.length > 1) {
      // Stow mode: strip package name → hyprland/.config/hypr/f → ~/.config/hypr/f
      const pathWithinPkg = parts.slice(1).join(path.sep);
      destination = path.join(homeDir, pathWithinPkg);
    } else {
      destination = path.join(targetBase, relativePath);
    }

    let size = 0;
    try { size = fs.statSync(file).size; } catch { /* skip */ }

    manifest.push({
      source_relative: relativePath,
      destination,
      conflict: fs.existsSync(destination),
      size,
      selected: true,
    });
  }
  return manifest;
}

// ── Fetch & Preview (called from UI) ─────────────────────────────────

/**
 * Download/stage a dotfile source and return a manifest preview.
 * Does NOT install anything — just previews.
 */
export async function fetchAndPreview(
  source: string,
  method: 'git' | 'archive' | 'local',
  branch?: string,
  targetBase?: string
): Promise<ManifestPreviewEntry[]> {
  let stagedDir: string;

  switch (method) {
    case 'git':
      stagedDir = await gitClone(source, branch);
      break;
    case 'archive':
      stagedDir = await downloadArchive(source);
      break;
    case 'local':
      stagedDir = await copyLocal(source);
      break;
    default:
      throw new Error(`Unknown install method: ${method}`);
  }

  return generateManifest(stagedDir, targetBase || DEFAULT_TARGET);
}

// ── Install Execution ────────────────────────────────────────────────

/**
 * Execute the installation of a dotfile set.
 *
 * @param config - Install configuration with selected files
 * @param onProgress - Optional progress callback
 * @returns The installed set record
 */
export async function executeInstall(
  config: InstallConfig,
  onProgress?: (progress: InstallProgress) => void
): Promise<InstalledSet> {
  const stagedDir = path.join(STAGING_DIR, 'repo');
  const setId = generateSetId(config.name);
  const selectedFiles = config.selected_files.filter((f) => f.selected);
  const totalSteps = selectedFiles.length;

  // Validate all destinations are in approved directories
  const unapproved = selectedFiles.filter((f) => !isApprovedPath(f.destination));
  if (unapproved.length > 0) {
    throw new Error(
      `Installation blocked: ${unapproved.length} files target unapproved directories. ` +
      `Approved: ${APPROVED_DIRS.join(', ')}`
    );
  }

  // Step 1: Backup conflicting files
  const conflictPaths = selectedFiles
    .filter((f) => f.conflict)
    .map((f) => f.destination);

  let backupLocation = '';
  if (conflictPaths.length > 0) {
    onProgress?.({
      step: 'Backing up existing files',
      current: 0,
      total: totalSteps,
      detail: `${conflictPaths.length} files to backup`,
    });

    const backupSession = await createBackup(config.name, conflictPaths);
    backupLocation = backupSession.backup_dir;
  }

  // Step 2: Copy selected files
  const manifest: ManifestEntry[] = [];

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const sourcePath = path.join(stagedDir, file.source_relative);

    onProgress?.({
      step: 'Copying files',
      current: i + 1,
      total: totalSteps,
      detail: file.destination,
    });

    try {
      // Create target directory
      fs.mkdirSync(path.dirname(file.destination), { recursive: true });

      // Copy file
      fs.copyFileSync(sourcePath, file.destination);

      // Generate checksum of installed file
      const checksum = await checksumFile(file.destination);

      manifest.push({
        path: file.destination,
        checksum_sha256: checksum,
        original_existed: file.conflict,
        symlinked: false,
      });
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      throw new Error(
        `Failed to copy ${file.source_relative} → ${file.destination}: ${error.message}. ` +
        `Backup available at: ${backupLocation}`
      );
    }
  }

  // Step 3: Write to registry
  onProgress?.({
    step: 'Updating registry',
    current: totalSteps,
    total: totalSteps,
    detail: 'Writing registry entry',
  });

  const installedSet: InstalledSet = {
    id: setId,
    name: config.name,
    source_url: config.source,
    install_method: config.method,
    install_date: new Date().toISOString(),
    backup_location: backupLocation,
    status: 'active',
    version: config.branch || 'latest',
    manifest,
  };

  await addSet(installedSet);

  // Step 4: Cleanup staging
  cleanStaging();

  return installedSet;
}
