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

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  new: { text: '+ NEW', cls: 'border-primary/30 text-primary bg-primary/5' },
  conflict: { text: '⚠ CONFLICT', cls: 'border-error/30 text-error bg-error/5' },
};

export default function InstallNew({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [sourceType, setSourceType] = useState<SourceType>('git');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [installPath, setInstallPath] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<ManifestPreviewEntry[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleFetch = async () => {
    if (!url) return;
    setIsFetching(true);
    setPreview(null);
    try {
      // The target base is normally `~/.config`. User can append `installPath`.
      // The backend adds `~/.config` if targetBase is empty, but let's let backend handle DEFAULT_TARGET if we pass empty string.
      const res = await window.dotman.install.fetchManifest(url, sourceType, branch, installPath);
      if (res.ok && res.data) {
        setPreview(res.data as ManifestPreviewEntry[]);
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
                    className="w-full bg-surface-lowest border border-outline-variant rounded-sm py-2.5 pl-9 pr-3 font-code text-[13px] text-on-surface focus:border-primary/50 focus:outline-none transition-colors"
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
