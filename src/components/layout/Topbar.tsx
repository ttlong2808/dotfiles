import type { Page } from '../../App';

const PAGE_TITLES: Record<Page, string> = {
  installed: 'Environment',
  install: 'Environment',
  keybindings: 'Environment',
  backups: 'Environment',
};

const TAB_ITEMS: { page: Page; label: string }[] = [
  { page: 'installed', label: 'Dashboard' },
  { page: 'install', label: 'Environment' },
  { page: 'backups', label: 'Logs' },
];

interface TopbarProps {
  currentPage: Page;
}

export default function Topbar({ currentPage }: TopbarProps) {
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
          <button className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
          </button>
          <button className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>
      </div>
    </header>
  );
}
