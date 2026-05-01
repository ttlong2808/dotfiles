/**
 * Type declarations for the DotMan API exposed via contextBridge.
 * Self-contained types for the renderer process — no imports from electron/.
 */

// ── Registry Types (mirror of electron/modules/registry.ts) ──────────

export interface ManifestEntry {
  path: string;
  checksum_sha256: string;
  original_existed: boolean;
  symlinked: boolean;
}

export interface InstalledSet {
  id: string;
  name: string;
  source_url: string;
  install_method: 'git' | 'archive' | 'local';
  install_date: string;
  backup_location: string;
  status: 'active' | 'inactive';
  version: string;
  manifest: ManifestEntry[];
}

export interface RegistryData {
  schema_version: number;
  last_modified: string;
  installed_sets: InstalledSet[];
}

// ── System Types (mirror of electron/modules/system.ts) ──────────────

export interface DistroInfo {
  name: string;
  id: string;
  version: string;
  package_manager: 'pacman' | 'apt' | 'dnf' | 'zypper' | 'unknown';
}

export interface SystemInfo {
  hyprland_running: boolean;
  hyprland_version: string | null;
  distro: DistroInfo;
  home_dir: string;
  username: string;
  hostname: string;
}

// ── IPC Types ────────────────────────────────────────────────────────

export interface IpcResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  download_url: string | null;
  release_notes: string;
  published_at: string;
}

export interface DependencyInfo {
  name: string;
  installed: boolean;
  required: boolean;
  source_hint: string;
}

export interface CompatibilityReport {
  dependencies: DependencyInfo[];
  missing_count: number;
  readme_found: boolean;
  install_instructions: string;
  conflict_count: number;
  score: 'ready' | 'warnings' | 'missing_deps';
  install_command: string;
}

export interface DotManAPI {
  registry: {
    load: () => Promise<IpcResult<RegistryData>>;
    save: (data: RegistryData) => Promise<IpcResult>;
  };
  system: {
    getInfo: () => Promise<IpcResult<SystemInfo>>;
    isHyprlandRunning: () => Promise<IpcResult<boolean>>;
    getDistro: () => Promise<IpcResult<DistroInfo>>;
  };
  backup: {
    create: (setId: string, files: string[]) => Promise<IpcResult>;
    restore: (backupPath: string, targetPath: string) => Promise<IpcResult>;
    list: () => Promise<IpcResult>;
    delete: (backupDir: string) => Promise<IpcResult>;
    quickSave: (setId: string) => Promise<IpcResult>;
    systemBackup: () => Promise<IpcResult>;
  };
  install: {
    fetchManifest: (url: string, method: string, branch?: string, targetBase?: string) => Promise<IpcResult>;
    execute: (config: unknown) => Promise<IpcResult>;
    abort: (taskId: string) => Promise<IpcResult>;
    checkCompatibility: (conflictCount: number) => Promise<IpcResult<CompatibilityReport>>;
  };
  uninstall: {
    execute: (setId: string) => Promise<IpcResult>;
  };
  keybindings: {
    scan: (setId?: string) => Promise<IpcResult>;
  };
  shell: {
    reloadHyprland: () => Promise<IpcResult>;
    reloadWaybar: () => Promise<IpcResult>;
  };
  update: {
    check: () => Promise<IpcResult<UpdateInfo>>;
    download: (url: string) => Promise<IpcResult<string>>;
  };
}

declare global {
  interface Window {
    dotman: DotManAPI;
  }
}
