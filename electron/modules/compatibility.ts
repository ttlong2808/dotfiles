/**
 * Compatibility Check Module
 *
 * Scans a staged dotfiles repo for README/INSTALL docs, parses dependency
 * lists, checks which packages are installed on the current system, and
 * returns a compatibility report.
 *
 * SAFETY: Read-only operations. No modifications to the system.
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { detectDistro, type DistroInfo } from './system';

// ── Types ────────────────────────────────────────────────────────────

export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Whether the package is currently installed */
  installed: boolean;
  /** Whether the package appears required (vs optional) */
  required: boolean;
  /** Where the dependency was found (e.g. "README.md", "INSTALL.md") */
  source_hint: string;
}

export interface CompatibilityReport {
  /** List of detected dependencies */
  dependencies: DependencyInfo[];
  /** Number of missing packages */
  missing_count: number;
  /** Whether a README was found */
  readme_found: boolean;
  /** Extracted install instructions section (raw text) */
  install_instructions: string;
  /** Number of file conflicts with existing config */
  conflict_count: number;
  /** Overall compatibility score */
  score: 'ready' | 'warnings' | 'missing_deps';
  /** Install command suggestion for missing packages */
  install_command: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Run a command and return stdout. Resolves with null on error. */
function runCommand(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10_000 }, (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ── Doc Scanner ──────────────────────────────────────────────────────

/** Files to look for documentation (case-insensitive search) */
const DOC_NAMES = [
  'README.md', 'readme.md', 'README', 'README.txt',
  'INSTALL.md', 'install.md', 'INSTALL', 'INSTALL.txt',
  'DEPENDENCIES.md', 'dependencies.md',
  'REQUIREMENTS.md', 'requirements.md',
];

/** Subdirectories that might contain install docs */
const DOC_DIRS = ['.install', 'docs', 'doc'];

interface DocFile {
  filename: string;
  content: string;
}

/** Scan the staged repo for documentation files */
function scanRepoDocs(stagedDir: string): DocFile[] {
  const results: DocFile[] = [];

  // Check root-level doc files
  for (const name of DOC_NAMES) {
    const filePath = path.join(stagedDir, name);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        results.push({ filename: name, content });
      }
    } catch { /* skip unreadable */ }
  }

  // Check doc subdirectories
  for (const dir of DOC_DIRS) {
    const dirPath = path.join(stagedDir, dir);
    try {
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
          if (entry.endsWith('.md') || entry.endsWith('.txt') || entry === 'README' || entry === 'INSTALL') {
            const filePath = path.join(dirPath, entry);
            if (fs.statSync(filePath).isFile()) {
              const content = fs.readFileSync(filePath, 'utf-8');
              results.push({ filename: `${dir}/${entry}`, content });
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  return results;
}

// ── Dependency Parser ────────────────────────────────────────────────

/**
 * Headings that typically introduce dependency lists.
 * Matched case-insensitively.
 */
const DEP_HEADINGS = [
  'dependencies', 'requirements', 'prerequisites',
  'required packages', 'packages', 'installation',
  'install', 'setup', 'getting started',
  'what you need', 'before you begin',
];

/**
 * Regex patterns for package install commands.
 * Each pattern captures the package list portion.
 */
const INSTALL_CMD_PATTERNS: RegExp[] = [
  // pacman / yay / paru
  /(?:sudo\s+)?(?:pacman|yay|paru)\s+-S(?:yu?)?\s+(?:--(?:needed|noconfirm)\s+)*(.+)/g,
  // apt / apt-get
  /(?:sudo\s+)?apt(?:-get)?\s+install\s+(?:-y\s+)?(.+)/g,
  // dnf / yum
  /(?:sudo\s+)?(?:dnf|yum)\s+install\s+(?:-y\s+)?(.+)/g,
  // zypper
  /(?:sudo\s+)?zypper\s+(?:in|install)\s+(.+)/g,
  // pip (for python tools like pywal)
  /pip3?\s+install\s+(.+)/g,
  // flatpak
  /flatpak\s+install\s+(?:-y\s+)?(?:\S+\s+)?(.+)/g,
];

/** Extract package names from a command-line match */
function extractPackagesFromCmd(match: string): string[] {
  return match
    .split(/\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('-') && !s.startsWith('#') && !s.includes('//'));
}

/** Extract the install instructions section from doc content */
function extractInstallSection(content: string): string {
  const lines = content.split('\n');
  let capturing = false;
  let sectionLines: string[] = [];
  let depth = 0;

  for (const line of lines) {
    // Detect heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const currentDepth = headingMatch[1].length;
      const title = headingMatch[2].toLowerCase().trim();

      if (capturing) {
        // Stop if we hit a same-level or higher heading that's not a dep heading
        if (currentDepth <= depth) {
          break;
        }
      }

      if (DEP_HEADINGS.some(h => title.includes(h))) {
        capturing = true;
        depth = currentDepth;
        sectionLines = [line];
        continue;
      }
    }

    if (capturing) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n').trim();
}

/**
 * Parse all dependency names from document content.
 * Returns unique package names with their source file.
 */
function parseDependencies(docs: DocFile[]): Map<string, { required: boolean; source: string }> {
  const deps = new Map<string, { required: boolean; source: string }>();

  for (const doc of docs) {
    const { filename, content } = doc;

    // Method 1: Find install command patterns
    for (const pattern of INSTALL_CMD_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const pkgs = extractPackagesFromCmd(match[1]);
        for (const pkg of pkgs) {
          if (!deps.has(pkg)) {
            deps.set(pkg, { required: true, source: filename });
          }
        }
      }
    }

    // Method 2: Find bullet lists under dependency headings
    const installSection = extractInstallSection(content);
    if (installSection) {
      const bulletLines = installSection.split('\n').filter(l => /^\s*[-*]\s+/.test(l));
      for (const line of bulletLines) {
        // Extract first word/backtick-word from bullet: "- hyprland" or "- `kitty`"
        const bulletMatch = line.match(/^\s*[-*]\s+`?([a-zA-Z0-9_-]+)`?/);
        if (bulletMatch) {
          const pkg = bulletMatch[1].toLowerCase();
          // Filter out common non-package words
          if (pkg.length > 1 && !NOISE_WORDS.has(pkg) && !deps.has(pkg)) {
            deps.set(pkg, { required: true, source: filename });
          }
        }
      }
    }
  }

  return deps;
}

/** Words that look like packages in bullet lists but aren't */
const NOISE_WORDS = new Set([
  'the', 'and', 'or', 'for', 'with', 'any', 'all', 'see', 'use',
  'run', 'install', 'optional', 'required', 'recommended', 'note',
  'clone', 'copy', 'make', 'sudo', 'then', 'also', 'here', 'this',
  'you', 'your', 'can', 'may', 'will', 'should', 'must', 'need',
  'if', 'to', 'in', 'on', 'at', 'by', 'it', 'is', 'be', 'do',
  'from', 'that', 'not', 'are', 'was', 'but', 'has', 'have',
]);

// ── Package Check ────────────────────────────────────────────────────

/** Check if a single package is installed using the system package manager */
async function isPackageInstalled(
  pkg: string,
  pkgManager: DistroInfo['package_manager']
): Promise<boolean> {
  let result: string | null = null;

  switch (pkgManager) {
    case 'pacman':
      result = await runCommand('pacman', ['-Q', pkg]);
      break;
    case 'apt':
      result = await runCommand('dpkg', ['-s', pkg]);
      break;
    case 'dnf':
      result = await runCommand('rpm', ['-q', pkg]);
      break;
    case 'zypper':
      result = await runCommand('rpm', ['-q', pkg]);
      break;
    default:
      // Can't check — assume installed to avoid false warnings
      return true;
  }

  return result !== null;
}

/** Check all dependencies against the system */
async function checkInstalledPackages(
  deps: Map<string, { required: boolean; source: string }>,
  pkgManager: DistroInfo['package_manager']
): Promise<DependencyInfo[]> {
  const results: DependencyInfo[] = [];

  // Check packages in parallel (batches of 10 to avoid too many processes)
  const entries = Array.from(deps.entries());

  for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    const checks = await Promise.all(
      batch.map(async ([name, info]) => {
        const installed = await isPackageInstalled(name, pkgManager);
        return {
          name,
          installed,
          required: info.required,
          source_hint: info.source,
        };
      })
    );
    results.push(...checks);
  }

  // Sort: missing first, then alphabetical
  results.sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/** Build the install command for missing packages */
function buildInstallCommand(
  missing: string[],
  pkgManager: DistroInfo['package_manager']
): string {
  if (missing.length === 0) return '';
  const pkgList = missing.join(' ');

  switch (pkgManager) {
    case 'pacman':
      return `sudo pacman -S --needed ${pkgList}`;
    case 'apt':
      return `sudo apt install -y ${pkgList}`;
    case 'dnf':
      return `sudo dnf install -y ${pkgList}`;
    case 'zypper':
      return `sudo zypper install ${pkgList}`;
    default:
      return `# Install manually: ${pkgList}`;
  }
}

// ── Main Entry Point ─────────────────────────────────────────────────

/**
 * Run a full compatibility check on a staged dotfiles repo.
 *
 * @param stagedDir - Path to the cloned/extracted repo in staging
 * @param conflictCount - Number of file conflicts from manifest preview
 */
export async function checkCompatibility(
  stagedDir: string,
  conflictCount: number = 0
): Promise<CompatibilityReport> {
  console.log(`[compat] Scanning repo at: ${stagedDir}`);

  // 1. Scan for documentation
  const docs = scanRepoDocs(stagedDir);
  const readmeFound = docs.some(d =>
    d.filename.toLowerCase().startsWith('readme')
  );

  console.log(`[compat] Found ${docs.length} doc files, readme=${readmeFound}`);

  // 2. Parse dependencies from docs
  const depsMap = parseDependencies(docs);
  console.log(`[compat] Parsed ${depsMap.size} dependencies`);

  // 3. Extract install instructions for display
  let installInstructions = '';
  for (const doc of docs) {
    const section = extractInstallSection(doc.content);
    if (section) {
      installInstructions = section;
      break;
    }
  }

  // 4. Check against system
  const distro = detectDistro();
  const dependencies = await checkInstalledPackages(depsMap, distro.package_manager);
  const missingCount = dependencies.filter(d => !d.installed).length;
  const missingNames = dependencies.filter(d => !d.installed).map(d => d.name);

  // 5. Build install command
  const installCommand = buildInstallCommand(missingNames, distro.package_manager);

  // 6. Determine score
  let score: CompatibilityReport['score'] = 'ready';
  if (missingCount > 0) {
    score = 'missing_deps';
  } else if (conflictCount > 0) {
    score = 'warnings';
  }

  console.log(`[compat] Result: ${missingCount} missing, ${conflictCount} conflicts, score=${score}`);

  return {
    dependencies,
    missing_count: missingCount,
    readme_found: readmeFound,
    install_instructions: installInstructions,
    conflict_count: conflictCount,
    score,
    install_command: installCommand,
  };
}
