import { useState, useEffect } from 'react';
import type { Page } from '../../App';

const TAB_ITEMS: { page: Page; label: string }[] = [
  { page: 'installed', label: 'Dashboard' },
  { page: 'install', label: 'Environment' },
  { page: 'backups', label: 'Logs' },
];

interface TopbarProps {
  currentPage: Page;
}

export default function Topbar({ currentPage }: TopbarProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  // Check for updates on mount
  useEffect(() => {
    const check = async () => {
      try {
        const res = await window.dotman.update.check();
        if (res.ok && res.data?.available && res.data.download_url) {
          setUpdateAvailable(true);
          setUpdateUrl(res.data.download_url);
        }
      } catch { /* silent */ }
    };
    check();
  }, []);

  const handleUpdate = async () => {
    if (!updateUrl) return;
    setDownloading(true);
    setUpdateMsg('');
    try {
      const res = await window.dotman.update.download(updateUrl);
      if (res.ok && res.data) {
        setUpdateMsg(`✅ Downloaded to ${res.data}. Run: sudo dpkg -i ${res.data}`);
        setUpdateAvailable(false);
      } else {
        setUpdateMsg(`❌ ${res.error}`);
      }
    } catch {
      setUpdateMsg('❌ Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <header className="flex justify-between items-center px-6 sticky top-0 w-full z-40 bg-[#050d1e]/80 backdrop-blur-xl h-12 border-b border-cyan-900/50">
      {/* Tab Nav */}
      <div className="flex items-center gap-6 font-code text-[11px] uppercase h-full tracking-wider">
        {TAB_ITEMS.map((tab) => {
          const isActive = currentPage === tab.page ||
            (tab.page === 'install' && ['install', 'keybindings'].includes(currentPage));
          return (
            <span
              key={tab.page}
              className={`h-full flex items-center cursor-default ${
                isActive
                  ? 'text-[#4dd9c8] border-b border-[#4dd9c8]'
                  : 'text-slate-400'
              }`}
            >
              {tab.label}
            </span>
          );
        })}
      </div>

      {/* Search & Actions */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[16px]">search</span>
          <input
            type="text"
            placeholder="SEARCH..."
            className="w-48 bg-surface/50 border border-cyan-900/50 rounded-sm py-1 pl-8 pr-2 font-code text-[11px] text-on-surface placeholder:text-slate-600 focus:border-primary/50 transition-colors h-7 focus:outline-none tracking-wider"
          />
        </div>
        <div className="flex items-center gap-3 text-[#4dd9c8]">
          <button className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">notifications</span>
          </button>

          {/* Update Button */}
          {updateAvailable ? (
            <button
              onClick={handleUpdate}
              disabled={downloading}
              className="relative opacity-100 hover:opacity-80 transition-opacity"
              title="Update available! Click to download."
            >
              <span className={`material-symbols-outlined text-[18px] ${downloading ? 'animate-spin' : ''}`}>
                {downloading ? 'sync' : 'system_update'}
              </span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f38ba8] animate-pulse" />
            </button>
          ) : (
            <button className="opacity-60 hover:opacity-100 transition-opacity" title="Up to date">
              <span className="material-symbols-outlined text-[18px]">cloud_done</span>
            </button>
          )}

          <button className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>

        {/* Update message toast */}
        {updateMsg && (
          <div className="absolute top-14 right-6 bg-surface-highest border border-cyan-900/50 rounded-sm p-3 font-code text-[11px] text-on-surface max-w-sm shadow-xl z-50">
            {updateMsg}
            <button onClick={() => setUpdateMsg('')} className="ml-2 text-slate-500 hover:text-slate-300">✕</button>
          </div>
        )}
      </div>
    </header>
  );
}
