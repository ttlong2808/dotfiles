/**
 * System Detection Module — Phase 1 (add-on)
 *
 * Detects:
 * 1. Whether Hyprland is currently running
 * 2. Which Linux distro is in use (Arch, Debian, Fedora, etc.)
 * 3. Available package manager
 * 4. Basic system info for the status bar
 *
 * SAFETY: Read-only operations. No modifications to the system.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';

// ── Types ────────────────────────────────────────────────────────────

export interface DistroInfo {
  /** Distro name from os-release (e.g., "Arch Linux") */
  name: string;
  /** Distro ID for scripting (e.g., "arch", "debian", "fedora") */
  id: string;
  /** Version string */
  version: string;
  /** Detected package manager binary */
  package_manager: 'pacman' | 'apt' | 'dnf' | 'zypper' | 'unknown';
}

export interface SystemInfo {
  /** Whether Hyprland compositor is running */
  hyprland_running: boolean;
  /** Hyprland version string if running */
  hyprland_version: string | null;
  /** Distro details */
  distro: DistroInfo;
  /** Home directory path */
  home_dir: string;
  /** Current user */
  username: string;
  /** Hostname */
  hostname: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Run a command and return stdout. Resolves with null on error. */
function runCommand(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ── Hyprland Detection ───────────────────────────────────────────────

/** Check if Hyprland is running by looking for the process */
export async function isHyprlandRunning(): Promise<boolean> {
  // Method 1: Check HYPRLAND_INSTANCE_SIGNATURE env var
  if (process.env.HYPRLAND_INSTANCE_SIGNATURE) {
    return true;
  }

  // Method 2: Try hyprctl (most reliable)
  const result = await runCommand('hyprctl', ['version']);
  if (result !== null) {
    return true;
  }

  // Method 3: pgrep
  const pgrep = await runCommand('pgrep', ['-x', 'Hyprland']);
  return pgrep !== null && pgrep.length > 0;
}

/** Get Hyprland version string */
export async function getHyprlandVersion(): Promise<string | null> {
  const output = await runCommand('hyprctl', ['version']);
  if (!output) return null;

  // Parse "Hyprland, built from branch ... at commit ... (tag vX.Y.Z)."
  const tagMatch = output.match(/tag\s+(v[\d.]+)/);
  if (tagMatch) return tagMatch[1];

  // Fallback: return first line
  return output.split('\n')[0] || null;
}

// ── Distro Detection ─────────────────────────────────────────────────

/** Parse /etc/os-release to detect the distro */
export function detectDistro(): DistroInfo {
  const fallback: DistroInfo = {
    name: 'Unknown Linux',
    id: 'unknown',
    version: '',
    package_manager: 'unknown',
  };

  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf-8');
    const fields: Record<string, string> = {};

    for (const line of osRelease.split('\n')) {
      const match = line.match(/^(\w+)=(.*)$/);
      if (match) {
        // Strip surrounding quotes
        fields[match[1]] = match[2].replace(/^"|"$/g, '');
      }
    }

    const id = (fields['ID'] || 'unknown').toLowerCase();

    return {
      name: fields['PRETTY_NAME'] || fields['NAME'] || 'Unknown Linux',
      id,
      version: fields['VERSION_ID'] || fields['VERSION'] || '',
      package_manager: detectPackageManager(id),
    };
  } catch {
    // Not Linux or /etc/os-release missing
    return fallback;
  }
}

/** Map distro ID to its package manager */
function detectPackageManager(distroId: string): DistroInfo['package_manager'] {
  // Arch-based
  if (['arch', 'manjaro', 'endeavouros', 'garuda', 'artix', 'cachyos'].includes(distroId)) {
    return 'pacman';
  }
  // Debian-based
  if (['debian', 'ubuntu', 'linuxmint', 'pop', 'elementary', 'zorin', 'kali'].includes(distroId)) {
    return 'apt';
  }
  // Fedora-based
  if (['fedora', 'nobara', 'centos', 'rhel', 'rocky', 'alma'].includes(distroId)) {
    return 'dnf';
  }
  // openSUSE
  if (['opensuse-tumbleweed', 'opensuse-leap', 'opensuse'].includes(distroId)) {
    return 'zypper';
  }

  return 'unknown';
}

// ── Combined System Info ─────────────────────────────────────────────

/** Gather all system information */
export async function getSystemInfo(): Promise<SystemInfo> {
  const [hyprRunning, hyprVersion] = await Promise.all([
    isHyprlandRunning(),
    getHyprlandVersion(),
  ]);

  return {
    hyprland_running: hyprRunning,
    hyprland_version: hyprVersion,
    distro: detectDistro(),
    home_dir: os.homedir(),
    username: os.userInfo().username,
    hostname: os.hostname(),
  };
}
