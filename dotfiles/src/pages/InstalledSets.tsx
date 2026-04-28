import { useState, useEffect } from 'react';
import type { Page } from '../App';
import type { InstalledSet } from '../types/dotman.d';
import ConfirmModal from '../components/modals/ConfirmModal';

type Filter = 'all' | 'active' | 'inactive' | 'updates';

const STATUS_ICONS: Record<string, string> = {
  active: 'terminal',
  inactive: 'palette',
  update: 'code_blocks',
};

interface InstalledSetsProps {
  onNavigate: (page: Page) => void;
}

export default function InstalledSets({ onNavigate }: InstalledSetsProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sets, setSets] = useState<InstalledSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [uninstallTarget, setUninstallTarget] = useState<InstalledSet | null>(null);

  const loadRegistry = async () => {
    try {
      setLoading(true);
      const res = await window.dotman.registry.load();
      if (res.ok && res.data) {
        setSets(res.data.installed_sets || []);
      }
    } catch (err) {
      console.error('Failed to load registry', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
  }, []);

  const handleUninstall = async () => {
    if (!uninstallTarget) return;
    try {
      const res = await window.dotman.uninstall.execute(uninstallTarget.id);
      if (res.ok) {
        console.log('Uninstalled successfully', res.data);
        await loadRegistry();
        
        // Reload Hyprland and Waybar
        window.dotman.shell.reloadHyprland();
        window.dotman.shell.reloadWaybar();
      } else {
        console.error('Failed to uninstall', res.error);
        alert(`Failed to uninstall: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUninstallTarget(null);
    }
  };

  const filtered = sets.filter((s) => {
    if (filter === 'active') return s.status === 'active';
    if (filter === 'inactive') return s.status === 'inactive';
    return true;
  });

  const counts = {
    all: sets.length,
    active: sets.filter((s) => s.status === 'active').length,
    inactive: sets.filter((s) => s.status === 'inactive').length,
    updates: 0,
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-end justify-between gap-4 mb-6 border-b border-cyan-900/30 pb-4">
        <div>
          <h1 className="text-[32px] font-bold text-on-background leading-tight tracking-tight">
            Installed Modules
          </h1>
          <p className="font-code text-[13px] text-on-surface-variant mt-1 tracking-wide">
            Manage active configuration sets and dependencies across environments.
          </p>
        </div>
        <button
          onClick={() => onNavigate('install')}
          className="bg-primary text-on-primary hover:brightness-110 border border-primary font-code text-[11px] font-bold px-4 py-2.5 rounded-sm transition-all flex items-center gap-2 h-9 uppercase tracking-widest shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          + Install New
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['all', 'active', 'inactive', 'updates'] as Filter[]).map((f) => {
          const isActive = filter === f;
          const label = f === 'updates'
            ? 'Has Updates'
            : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-code text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-sm border transition-colors ${
                isActive
                  ? 'border-[#4dd9c8] text-[#4dd9c8] bg-cyan-400/10'
                  : 'border-cyan-900/50 text-slate-400 hover:text-cyan-200 hover:border-cyan-400/50'
              }`}
            >
              {label}
              {f === 'updates' && (
                <span className="inline-block w-2 h-2 rounded-full bg-tertiary-dim ml-1.5 align-middle" />
              )}
            </button>
          );
        })}
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4 animate-spin">sync</span>
          <h2 className="text-[24px] font-semibold text-slate-400 mb-2">Loading registry...</h2>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              onUninstall={() => setUninstallTarget(set)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-600 mb-4">package_2</span>
          <h2 className="text-[24px] font-semibold text-slate-400 mb-2">No dotfile sets installed</h2>
          <p className="font-code text-[13px] text-slate-500 mb-6">
            Browse preset configurations or install from a Git URL.
          </p>
          <button
            onClick={() => onNavigate('install')}
            className="bg-primary text-on-primary font-code text-[11px] font-bold px-5 py-2.5 rounded-sm uppercase tracking-widest"
          >
            + Install from URL
          </button>
        </div>
      )}

      {/* Uninstall Confirmation Modal */}
      {uninstallTarget && (
        <ConfirmModal
          title={`Uninstall ${uninstallTarget.name}?`}
          message={`This will remove all files associated with "${uninstallTarget.name}" from your system. A backup will be created first.`}
          confirmText="Uninstall"
          confirmValue={uninstallTarget.name}
          variant="danger"
          onConfirm={handleUninstall}
          onCancel={() => setUninstallTarget(null)}
        />
      )}
    </div>
  );
}

// ── Set Card Component ───────────────────────────────────────────────

function SetCard({
  set,
  onUninstall,
}: {
  set: InstalledSet;
  onUninstall: () => void;
}) {
  const isActive = set.status === 'active';
  const iconName = STATUS_ICONS[set.status] || 'package_2';
  const installDate = new Date(set.install_date).toLocaleDateString('en-CA');

  return (
    <div
      className={`
        bg-surface-mid/50 backdrop-blur-md border rounded-sm overflow-hidden
        flex flex-col relative group transition-colors
        ${isActive
          ? 'border-cyan-900/50 hover:border-primary/50'
          : 'border-cyan-900/30 hover:border-cyan-900/60 opacity-70'
        }
      `}
    >
      {/* Active indicator bar */}
      {isActive && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}

      {/* Header */}
      <div className="p-4 border-b border-cyan-900/30 flex justify-between items-start bg-slate-900/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-primary' : 'text-slate-500'}`}>
              {iconName}
            </span>
            <h3 className={`text-[16px] font-semibold ${isActive ? 'text-on-background' : 'text-slate-400'}`}>
              {set.name}
            </h3>
          </div>
          <p className="font-code text-[11px] text-on-surface-variant truncate max-w-[240px]" title={set.source_url}>
            {set.source_url}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 font-code text-[9px] font-bold uppercase rounded-sm border ${
            isActive
              ? 'border-primary/30 text-primary bg-primary/5'
              : 'border-slate-600/30 text-slate-500 bg-slate-800/30'
          }`}
        >
          {set.status}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block font-code text-[9px] text-slate-500 uppercase font-bold">Version</span>
            <span className="font-code text-xs text-on-surface">{set.version}</span>
          </div>
          <div>
            <span className="block font-code text-[9px] text-slate-500 uppercase font-bold">Installed</span>
            <span className="font-code text-xs text-on-surface">{installDate}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-3 border-t border-cyan-900/20 flex gap-2">
          {isActive ? (
            <>
              <button className="flex-1 bg-surface-highest hover:bg-surface-bright text-on-surface border border-outline-variant font-code text-[10px] font-bold py-1.5 rounded-sm transition-colors uppercase tracking-wider">
                Configure
              </button>
              <button
                onClick={onUninstall}
                className="bg-surface-highest hover:bg-error/20 hover:text-error hover:border-error/50 text-on-surface-variant border border-outline-variant w-8 flex justify-center items-center rounded-sm transition-colors"
                title="Uninstall"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </>
          ) : (
            <button className="flex-1 bg-surface-highest/50 hover:bg-surface-bright hover:text-on-surface text-slate-400 border border-outline-variant/50 font-code text-[10px] font-bold py-1.5 rounded-sm transition-colors uppercase tracking-wider">
              Activate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
