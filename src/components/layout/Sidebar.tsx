import type { Page } from '../../App';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS: { page: Page; icon: string; label: string; section: 'library' | 'tools' }[] = [
  { page: 'installed', icon: 'extension', label: 'Modules', section: 'library' },
  { page: 'install', icon: 'database', label: 'Repositories', section: 'library' },
  { page: 'keybindings', icon: 'folder_open', label: 'Configurations', section: 'library' },
  { page: 'backups', icon: 'history', label: 'History', section: 'tools' },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <nav className="w-64 h-screen border-r border-cyan-900/50 bg-[#050d1e] flex flex-col fixed left-0 top-0 z-50">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-cyan-900/30 gap-3">
        <span className="material-symbols-outlined text-primary-dim text-[22px]">deployed_code</span>
        <div>
          <span className="text-xl font-black tracking-tighter text-[#4dd9c8] italic">DOTMAN</span>
          <p className="font-code text-[9px] text-cyan-700 uppercase tracking-[0.2em]">STATION-04 // ACTIVE</p>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`
                w-full text-left px-5 py-3 flex items-center gap-3
                font-code text-[11px] uppercase tracking-[0.15em]
                transition-all duration-150
                ${isActive
                  ? 'bg-cyan-400/10 text-[#4dd9c8] border-l-2 border-[#4dd9c8]'
                  : 'text-slate-500 hover:text-cyan-200 hover:bg-slate-900/50 border-l-2 border-transparent'
                }
              `}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#4dd9c8]' : ''}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Sync Button */}
      <div className="p-4 border-t border-cyan-900/30">
        <button className="w-full bg-cyan-400/10 hover:bg-primary text-primary hover:text-on-primary border border-cyan-400/50 hover:border-primary font-code text-[11px] font-bold py-2.5 px-4 rounded-sm transition-all duration-150 flex items-center justify-center gap-2 uppercase tracking-widest">
          <span className="material-symbols-outlined text-[16px]">sync</span>
          SYNC ALL
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-cyan-900/30 py-2 flex flex-col">
        <button className="text-slate-500 hover:text-cyan-200 px-5 py-2.5 transition-colors hover:bg-slate-900/50 flex items-center gap-3 font-code text-[11px] uppercase tracking-[0.15em]">
          <span className="material-symbols-outlined text-[20px]">menu_book</span>
          Docs
        </button>
        <button className="text-slate-500 hover:text-cyan-200 px-5 py-2.5 transition-colors hover:bg-slate-900/50 flex items-center gap-3 font-code text-[11px] uppercase tracking-[0.15em]">
          <span className="material-symbols-outlined text-[20px]">settings</span>
          System
        </button>
      </div>
    </nav>
  );
}
