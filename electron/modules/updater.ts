/**
 * Updater Module — Self-update via GitHub Releases
 * Checks for new versions, downloads .deb, and prompts install.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

const GITHUB_REPO = 'ttlong2808/dotfiles';

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  download_url: string | null;
  release_notes: string;
  published_at: string;
}

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

/** Check GitHub Releases for a newer version */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = getCurrentVersion();
  const release = await fetchJSON(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);

  const latestTag = (release.tag_name || '').replace(/^v/, '');
  const publishedAt = release.published_at || '';
  const debAsset = (release.assets || []).find((a: any) => a.name?.endsWith('.deb'));

  // Compare: if tag is "latest", compare by published date
  const isNewer = latestTag === 'latest'
    ? new Date(publishedAt).getTime() > (Date.now() - 3600_000) // less than 1 hour ago = maybe new
    : latestTag !== currentVersion;

  return {
    available: isNewer,
    current_version: currentVersion,
    latest_version: latestTag || 'latest',
    download_url: debAsset?.browser_download_url || null,
    release_notes: release.body || 'No release notes.',
    published_at: publishedAt,
  };
}

/** Download a file from URL to ~/Downloads, following redirects */
export async function downloadUpdate(url: string): Promise<string> {
  const downloadDir = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(downloadDir, { recursive: true });
  const filePath = path.join(downloadDir, 'DotMan-latest.deb');

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
        const file = fs.createWriteStream(filePath);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(filePath); });
        file.on('error', reject);
      }).on('error', reject);
    };
    download(url);
  });
}
