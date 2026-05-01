/**
 * Updater Module — Self-update via GitHub Releases
 *
 * Flow:
 * 1. Check GitHub API for latest release
 * 2. Compare published_at timestamp (since tag is always "latest")
 * 3. Download the right asset based on distro (AppImage for Arch, .deb for Debian)
 * 4. Auto-install: replace AppImage in place, or run dpkg -i for .deb
 *
 * SAFETY: Downloads go to ~/Downloads first. Install requires confirmation.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { detectDistro } from './system';

const GITHUB_REPO = 'ttlong2808/dotfiles';

/** Path to persist the last-checked timestamp */
const TIMESTAMP_FILE = path.join(os.homedir(), '.cache', 'dotman', 'last_update_check.json');

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  download_url: string | null;
  asset_name: string;
  release_notes: string;
  published_at: string;
  package_type: 'appimage' | 'deb';
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Read current app version from package.json */
function getCurrentVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Read the last known published_at timestamp */
function getLastCheckedTimestamp(): string {
  try {
    if (fs.existsSync(TIMESTAMP_FILE)) {
      const data = JSON.parse(fs.readFileSync(TIMESTAMP_FILE, 'utf-8'));
      return data.published_at || '';
    }
  } catch { /* ignore */ }
  return '';
}

/** Save the published_at timestamp after successful install */
function saveCheckedTimestamp(publishedAt: string): void {
  try {
    fs.mkdirSync(path.dirname(TIMESTAMP_FILE), { recursive: true });
    fs.writeFileSync(TIMESTAMP_FILE, JSON.stringify({ published_at: publishedAt }));
  } catch { /* ignore */ }
}

/** Fetch JSON from HTTPS URL (follows redirects) */
function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': 'DotMan-Updater', 'Accept': 'application/vnd.github+json' },
    };
    https.get(opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location!).then(resolve, reject);
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from GitHub API')); }
      });
    }).on('error', reject);
  });
}

/** Run a shell command and return stdout */
function runShell(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[updater] Running: ${cmd} ${args.join(' ')}`);
    execFile(cmd, args, { timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[updater] Failed: ${error.message}, stderr: ${stderr}`);
        reject(new Error(`${cmd} failed: ${error.message}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ── Check ────────────────────────────────────────────────────────────

/** Check GitHub Releases for a newer version */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = getCurrentVersion();
  const distro = detectDistro();
  const isArchBased = distro.package_manager === 'pacman';

  const release = await fetchJSON(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);

  const latestTag = (release.tag_name || '').replace(/^v/, '');
  const publishedAt = release.published_at || '';
  const assets = release.assets || [];

  // Find the right asset based on distro
  let asset: any = null;
  let packageType: 'appimage' | 'deb' = 'appimage';

  if (isArchBased) {
    // Arch/Manjaro → prefer AppImage
    asset = assets.find((a: any) => a.name?.endsWith('.AppImage'));
    packageType = 'appimage';
  } else {
    // Debian/Ubuntu → prefer .deb
    asset = assets.find((a: any) => a.name?.endsWith('.deb'));
    packageType = 'deb';
    // Fallback to AppImage if no .deb
    if (!asset) {
      asset = assets.find((a: any) => a.name?.endsWith('.AppImage'));
      packageType = 'appimage';
    }
  }

  // Determine if update is available by comparing published_at with last check
  const lastChecked = getLastCheckedTimestamp();
  let isNewer = false;

  if (!lastChecked) {
    // First run — save current timestamp, don't prompt update
    saveCheckedTimestamp(publishedAt);
  } else {
    isNewer = publishedAt !== '' && publishedAt !== lastChecked;
  }

  console.log(`[updater] Current: ${currentVersion}, Remote tag: ${latestTag}, Published: ${publishedAt}, LastChecked: ${lastChecked}, isNewer: ${isNewer}`);

  return {
    available: !!isNewer,
    current_version: currentVersion,
    latest_version: latestTag || 'latest',
    download_url: asset?.browser_download_url || null,
    asset_name: asset?.name || '',
    release_notes: release.body || 'No release notes.',
    published_at: publishedAt,
    package_type: packageType,
  };
}

// ── Download & Install ───────────────────────────────────────────────

/** Download a file from URL, following redirects */
function downloadFile(url: string, destPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const download = (dlUrl: string) => {
      const parsed = new URL(dlUrl);
      const opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'DotMan-Updater' },
      };
      https.get(opts, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return download(res.headers.location!);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(destPath); });
        file.on('error', reject);
      }).on('error', reject);
    };
    download(url);
  });
}

/**
 * Download the update and auto-install.
 *
 * For AppImage:
 *   1. Download to ~/Downloads/DotMan-latest.AppImage
 *   2. chmod +x
 *   3. If running as AppImage, replace the current binary
 *
 * For .deb:
 *   1. Download to ~/Downloads/DotMan-latest.deb
 *   2. Run pkexec dpkg -i (graphical sudo prompt)
 */
export async function downloadUpdate(url: string, publishedAt: string): Promise<string> {
  const distro = detectDistro();
  const isArchBased = distro.package_manager === 'pacman';
  const downloadDir = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(downloadDir, { recursive: true });

  if (isArchBased) {
    // ── AppImage flow ──────────────────────────────────────────
    const destPath = path.join(downloadDir, 'DotMan-latest.AppImage');

    console.log(`[updater] Downloading AppImage to: ${destPath}`);
    await downloadFile(url, destPath);

    // Make executable
    fs.chmodSync(destPath, 0o755);

    // If currently running as AppImage, replace it in place
    const currentAppImage = process.env.APPIMAGE;
    if (currentAppImage && fs.existsSync(currentAppImage)) {
      try {
        console.log(`[updater] Replacing AppImage: ${currentAppImage}`);
        fs.copyFileSync(destPath, currentAppImage);
        fs.chmodSync(currentAppImage, 0o755);

        // Save timestamp so we don't prompt again
        saveCheckedTimestamp(publishedAt);

        return `Updated! Restart the app to apply. (${currentAppImage})`;
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        console.error(`[updater] Failed to replace AppImage: ${error.message}`);
        // Fall through to manual message
      }
    }

    // Save timestamp
    saveCheckedTimestamp(publishedAt);

    return `Downloaded to ${destPath}. Run: chmod +x "${destPath}" && "${destPath}"`;
  } else {
    // ── .deb flow ──────────────────────────────────────────────
    const destPath = path.join(downloadDir, 'DotMan-latest.deb');

    console.log(`[updater] Downloading .deb to: ${destPath}`);
    await downloadFile(url, destPath);

    // Try auto-install with pkexec (graphical sudo)
    try {
      await runShell('pkexec', ['dpkg', '-i', destPath]);

      // Fix any missing deps
      try {
        await runShell('pkexec', ['apt-get', 'install', '-f', '-y']);
      } catch { /* optional */ }

      // Save timestamp
      saveCheckedTimestamp(publishedAt);

      return `Updated successfully! Restart the app to apply.`;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      console.warn(`[updater] Auto-install failed: ${error.message}`);

      // Save timestamp anyway
      saveCheckedTimestamp(publishedAt);

      return `Downloaded to ${destPath}. Run: sudo dpkg -i "${destPath}"`;
    }
  }
}
