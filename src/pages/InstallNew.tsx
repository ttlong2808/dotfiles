import { useState } from 'react';
import type { Page } from '../App';

type SourceType = 'git' | 'archive' | 'local';

interface ManifestPreviewEntry {
  source_relative: string;
  destination: string;
  conflict: boolean;
  size: number;
  selected: boolean;
}

interface DependencyInfo {
  name: string;
  installed: boolean;
  required: boolean;
  source_hint: string;
}

interface CompatReport {
  dependencies: DependencyInfo[];
  missing_count: number;
  readme_found: boolean;
  install_instructions: string;
  conflict_count: number;
  score: 'ready' | 'warnings' | 'missing_deps';
  install_command: string;
}

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  new: { text: '+ NEW', cls: 'border-primary/30 text-primary bg-primary/5' },
  conflict: { text: '⚠ CONFLICT', cls: 'border-error/30 text-error bg-error/5' },
};

const SCORE_CONFIG: Record<string, { icon: string; label: string; cls: string; border: string }> = {
  ready: {
    icon: 'check_circle',
    label: 'READY TO INSTALL',
    cls: 'text-emerald-400',
    border: 'border-emerald-500/30 bg-emerald-500/5',
  },
  warnings: {
    icon: 'warning',
    label: 'WARNINGS — REVIEW BEFORE INSTALL',
    cls: 'text-amber-400',
    border: 'border-amber-500/30 bg-amber-500/5',
  },
  missing_deps: {
    icon: 'error',
    label: 'MISSING DEPENDENCIES',
    cls: 'text-red-400',
    border: 'border-red-500/30 bg-red-500/5',
  },
};

export default function InstallNew({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [sourceType, setSourceType] = useState<SourceType>('git');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [installPath, setInstallPath] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<ManifestPreviewEntry[] | null>(null);
  const [compat, setCompat] = useState<CompatReport | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleFetch = async () => {
    if (!url) return;

    // Validate URL: reject shell commands and non-URL inputs
    if (sourceType === 'git' || sourceType === 'archive') {
      const trimmed = url.trim();
      if (trimmed.includes('$(') || trimmed.includes('`') || trimmed.startsWith('bash ') || trimmed.startsWith('curl ')) {
        alert('Invalid URL: Please enter a direct Git URL (e.g. https://github.com/user/repo) — not a shell command.');
        return;
      }
      if (sourceType === 'git' && !trimmed.match(/^(https?:\/\/|git@|ssh:\/\/)/) && !trimmed.endsWith('.git')) {
        alert('Invalid Git URL. Expected format: https://github.com/user/repo or git@github.com:user/repo');
        return;
      }
    }
    setIsFetching(true);
    setPreview(null);
    setCompat(null);
    try {
      const res = await window.dotman.install.fetchManifest(url, sourceType, branch, installPath);
      if (res.ok && res.data) {
        const manifestData = res.data as ManifestPreviewEntry[];
        setPreview(manifestData);

        // Auto-run compatibility check
        const conflictCount = manifestData.filter(f => f.conflict).length;
        const compatRes = await window.dotman.install.checkCompatibility(conflictCount);
        if (compatRes.ok && compatRes.data) {
          setCompat(compatRes.data as CompatReport);
        }
      } else {
        alert(`Fetch failed: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during fetch');
    } finally {
      setIsFetching(false);
    }
  };

  const handleInstall = async () => {
    if (!preview || !name) {
      alert('Please provide a name for this dotfile set.');
      return;
    }
    setIsInstalling(true);
    try {
      const config = {
        name,
        source: url,
        method: sourceType,
        branch,
        target_base: installPath,
        selected_files: preview,
      };
      const res = await window.dotman.install.execute(config);
      if (res.ok) {
        // Reload Waybar/Hyprland on success (safe — won't crash if not installed)
        try { await window.dotman.shell.reloadHyprland(); } catch { /* skip */ }
        try { await window.dotman.shell.reloadWaybar(); } catch { /* skip */ }
        onNavigate('installed');
      } else {
        alert(`Install failed: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during install');
    } finally {
      setIsInstalling(false);
    }
  };

  const toggleSelect = (index: number) => {
    if (!preview) return;
    const newPreview = [...preview];
    newPreview[index].selected = !newPreview[index].selected;
    setPreview(newPreview);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const copyInstallCmd = () => {
    if (!compat?.install_command) return;
    navigator.clipboard.writeText(compat.install_command);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 border-b border-cyan-900/30 pb-4">
        <h1 className="text-[32px] font-bold text-on-background leading-tight tracking-tight">
          Install New Source
        </h1>
        <p className="font-code text-[13px] text-on-surface-variant mt-1 tracking-wide">
          Fetch and integrate dotfile packages from external repositories or local archives.
        </p>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Source Configuration */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface-mid/50 backdrop-blur-md border border-cyan-900/50 rounded-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-900/30">
              <span className="font-code text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                Source Configuration
              </span>
              <span className="material-symbols-outlined text-[16px] text-slate-500">code</span>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Source Type Selector */}
              <div>
                <label className="block font-code text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">
                  Source Type
                </label>
                <div className="flex gap-2">
                  {(['git', 'archive', 'local'] as SourceType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSourceType(type)}
                      className={`flex-1 font-code text-[11px] font-bold py-2.5 rounded-sm border transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                        sourceType === type
                          ? 'border-primary/50 text-primary bg-primary/10'
                          : 'border-cyan-900/50 text-slate-400 hover:border-cyan-400/30 hover:text-cyan-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {type === 'git' ? 'code' : type === 'archive' ? 'inventory_2' : 'folder'}
                      </span>
                      {type === 'git' ? '<> Git' : type === 'archive' ? 'Archive' : 'Local'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Set Name */}
              <div>
                <label className="block font-code text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">
                  Set Name (Required)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-cool-theme"
                  className="w-full bg-surface-lowest border border-outline-variant rounded-sm py-2.5 px-3 font-code text-[13px] text-on-surface placeholder:text-slate-600 focus:border-primary/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Repository URL */}
              <div>
                <label className="block font-code text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">
                  {sourceType === 'local' ? 'Local Path' : 'Source URL'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[14px]">link</span>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={sourceType === 'local' ? '/path/to/local/dir' : 'https://github.com/dotman-themes/iceberg...'}
                    className="w-full bg-surface-lowest border border-outline-variant rounded-sm py-2.5 pl-9 pr-3 font-code text-[13px] text-on-surface placeholder:text-slate-600 focus:border-primary/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Branch / Tag */}
              {sourceType === 'git' && (
                <div>
                  <label className="block font-code text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">
                    Branch / Tag
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[14px]">commit</span>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="Default (auto-detect)"
                      className="w-full bg-surface-lowest border border-outline-variant rounded-sm py-2.5 pl-9 pr-3 font-code text-[13px] text-on-surface placeholder:text-slate-600 focus:border-primary/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Install Path */}
              <div>
                <label className="block font-code text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">
                  Target Base Path (Optional override)
                </label>
                <input
                  type="text"
                  value={installPath}
                  onChange={(e) => setInstallPath(e.target.value)}
                  placeholder="~/.config (Default)"
                  className="w-full bg-surface-lowest py-2.5 px-3 border border-outline-variant rounded-sm font-code text-[13px] text-on-surface placeholder:text-slate-600 focus:outline-none"
                />
              </div>

              {/* Fetch Button */}
              <button
                onClick={handleFetch}
                disabled={isFetching || !url}
                className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-on-primary border border-primary/30 hover:border-primary font-code text-[11px] font-bold py-3 rounded-sm transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isFetching ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    Fetching...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    Fetch & Preview Manifest
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compatibility Report Panel */}
          {compat && (
            <div className={`bg-surface-mid/50 backdrop-blur-md border rounded-sm ${SCORE_CONFIG[compat.score].border}`}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-900/30">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[16px] ${SCORE_CONFIG[compat.score].cls}`}>
                    {SCORE_CONFIG[compat.score].icon}
                  </span>
                  <span className="font-code text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Compatibility Check
                  </span>
                </div>
                <span className={`px-2 py-0.5 font-code text-[9px] font-bold uppercase rounded-sm border ${SCORE_CONFIG[compat.score].border} ${SCORE_CONFIG[compat.score].cls}`}>
                  {SCORE_CONFIG[compat.score].label}
                </span>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Dependencies List */}
                {compat.dependencies.length > 0 && (
                  <div>
                    <div className="font-code text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">
                      Dependencies ({compat.dependencies.length} detected, {compat.missing_count} missing)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {compat.dependencies.map((dep) => (
                        <span
                          key={dep.name}
                          title={`Found in: ${dep.source_hint}`}
                          className={`inline-flex items-center gap-1 px-2 py-1 font-code text-[11px] rounded-sm border ${
                            dep.installed
                              ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                              : 'border-red-500/30 text-red-400 bg-red-500/5'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {dep.installed ? 'check' : 'close'}
                          </span>
                          {dep.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {compat.dependencies.length === 0 && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    <span className="font-code text-[12px]">
                      No dependency info found in repo docs. Make sure the repo has a README with install instructions.
                    </span>
                  </div>
                )}

                {/* Install Command */}
                {compat.install_command && (
                  <div>
                    <div className="font-code text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">
                      Install Missing Packages
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface-lowest border border-cyan-900/50 rounded-sm px-3 py-2 font-code text-[12px] text-cyan-300 overflow-x-auto whitespace-nowrap">
                        {compat.install_command}
                      </code>
                      <button
                        onClick={copyInstallCmd}
                        className="px-3 py-2 border border-cyan-900/50 rounded-sm hover:bg-primary/10 transition-colors"
                        title="Copy to clipboard"
                      >
                        <span className="material-symbols-outlined text-[14px] text-slate-400">
                          {copiedCmd ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Install Instructions from README */}
                {compat.install_instructions && (
                  <details className="group">
                    <summary className="font-code text-[10px] text-slate-500 uppercase font-bold tracking-widest cursor-pointer hover:text-cyan-300 transition-colors flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] group-open:rotate-90 transition-transform">
                        chevron_right
                      </span>
                      Install Instructions from README
                    </summary>
                    <pre className="mt-2 bg-surface-lowest border border-cyan-900/50 rounded-sm px-4 py-3 font-code text-[12px] text-slate-300 overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                      {compat.install_instructions}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Manifest Preview */}
        <div className="bg-surface-mid/50 backdrop-blur-md border border-cyan-900/50 rounded-sm flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-900/30">
            <div className="flex items-center gap-2">
              <span className="font-code text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                Manifest Preview
              </span>
              {preview && (
                <span className="px-2 py-0.5 font-code text-[9px] font-bold uppercase rounded-sm border border-primary/30 text-primary bg-primary/5">
                  {preview.filter(f => f.selected).length} ITEMS SELECTED
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-[16px] text-slate-500">content_copy</span>
          </div>

          {preview ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center px-5 py-2 border-b border-cyan-900/30 font-code text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                <span className="w-8"></span>
                <span className="flex-1">Source Path</span>
                <span className="w-24 text-center">Status</span>
                <span className="w-20 text-right">Size</span>
              </div>

              <div className="overflow-y-auto flex-1">
                {preview.map((file, i) => {
                  const status = file.conflict ? 'conflict' : 'new';
                  const badge = STATUS_BADGE[status];
                  return (
                    <div
                      key={i}
                      className={`flex items-center px-5 py-3 border-b border-cyan-900/20 hover:bg-surface-highest/30 transition-colors ${
                        file.conflict ? 'border-l-2 border-l-error/50' : ''
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 mr-4 cursor-pointer" 
                        checked={file.selected}
                        onChange={() => toggleSelect(i)} 
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">description</span>
                        <span className="font-code text-[13px] text-on-surface truncate" title={file.source_relative}>
                          {file.source_relative}
                        </span>
                      </div>
                      <span className={`w-24 text-center px-2 py-0.5 font-code text-[9px] font-bold uppercase rounded-sm border ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <span className="w-20 text-right font-code text-[12px] text-slate-400">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-t border-cyan-900/30 bg-surface-lowest/30 mt-auto">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">deployed_code</span>
                  <span className="font-code text-[12px] text-slate-400">
                    {preview.filter(f => f.conflict && f.selected).length} conflicts will be backed up automatically.
                  </span>
                </div>
                <button 
                  onClick={handleInstall}
                  disabled={isInstalling || !name || preview.filter(f => f.selected).length === 0}
                  className="bg-primary text-on-primary hover:brightness-110 font-code text-[11px] font-bold px-5 py-2 rounded-sm transition-all uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                >
                  {isInstalling ? (
                    <><span className="material-symbols-outlined text-[14px] animate-spin">sync</span>Installing...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[14px]">play_arrow</span>Install Manifest Now</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6 flex-1">
              <span className="material-symbols-outlined text-[36px] text-slate-600 mb-3">file_open</span>
              <p className="font-code text-[12px] text-slate-500">
                Manifest preview will appear here after fetching a source.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
