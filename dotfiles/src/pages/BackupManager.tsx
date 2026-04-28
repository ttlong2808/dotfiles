import { useState, useEffect } from 'react';
import ConfirmModal from '../components/modals/ConfirmModal';

interface BackupEntry {
  original_path: string;
  backup_path: string;
  checksum: string;
  size: number;
}

interface BackupSession {
  id: string;
  set_name: string;
  created_at: string;
  backup_dir: string;
  entries: BackupEntry[];
  total_size: number;
}

export default function BackupManager() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sessions, setSessions] = useState<BackupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const res = await window.dotman.backup.list();
      if (res.ok && res.data) {
        setSessions(res.data as BackupSession[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleRestore = async (session: BackupSession) => {
    if (!confirm('Are you sure you want to restore these files? This will overwrite existing files.')) return;
    try {
      let successCount = 0;
      for (const entry of session.entries) {
        const res = await window.dotman.backup.restore(entry.backup_path, entry.original_path);
        if (res.ok) successCount++;
      }
      alert(`Restored ${successCount}/${session.entries.length} files successfully.`);
      // Reload Hyprland/Waybar after restore
      window.dotman.shell.reloadHyprland();
      window.dotman.shell.reloadWaybar();
    } catch (err) {
      console.error(err);
      alert('Error during restoration');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await window.dotman.backup.delete(deleteTarget);
      if (res.ok) {
        await loadBackups();
      } else {
        alert(`Failed to delete backup: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const totalStorageBytes = sessions.reduce((sum, s) => sum + s.total_size, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 border-b border-cyan-900/30 pb-4">
        <div>
          <h1 className="text-[32px] font-bold text-on-background leading-tight tracking-tight uppercase">Backup Manager</h1>
          <p className="font-code text-[12px] text-on-surface-variant mt-1 tracking-widest uppercase">System Snapshots & Archival</p>
        </div>
        <button onClick={loadBackups} className="bg-surface-highest hover:bg-surface-bright border border-outline-variant text-on-surface font-code text-[11px] font-bold px-4 py-2.5 rounded-sm transition-all uppercase tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-mid/50 border border-cyan-900/50 rounded-sm p-5">
          <span className="block font-code text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">Total Backups</span>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-on-background">{sessions.length}</span>
            <span className="font-code text-[13px] text-slate-400">snapshots</span>
          </div>
        </div>
        <div className="bg-surface-mid/50 border border-cyan-900/50 rounded-sm p-5">
          <span className="block font-code text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">Storage Used</span>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-on-background">{formatSize(totalStorageBytes)}</span>
          </div>
          <div className="mt-3 h-1 bg-surface-highest rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: Math.min(100, (totalStorageBytes / (1024*1024*1024)) * 10) + '%' }} />
          </div>
        </div>
        <div className="bg-surface-mid/50 border border-cyan-900/50 rounded-sm p-5">
          <span className="block font-code text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">Safety Status</span>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-on-background text-primary">SECURE</span>
          </div>
          <p className="font-code text-[11px] text-slate-500 mt-1">Automatic backups before delete</p>
        </div>
      </div>

      {/* Snapshots Table */}
      <div className="bg-surface-mid/50 border border-cyan-900/50 rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-900/30">
          <span className="font-code text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Recent Snapshots</span>
        </div>

        <div className="flex items-center px-5 py-2 border-b border-cyan-900/30 font-code text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          <span className="w-44">Snapshot ID</span><span className="w-44">Target Set</span><span className="flex-1">Timestamp</span><span className="w-24 text-right">Size</span><span className="w-10" />
        </div>

        {loading ? (
          <div className="py-10 text-center"><span className="material-symbols-outlined text-[32px] text-slate-500 animate-spin">sync</span></div>
        ) : sessions.length === 0 ? (
          <div className="py-10 text-center text-slate-500 font-code text-[12px]">No backups found.</div>
        ) : sessions.map((snap) => (
          <div key={snap.id}>
            <div onClick={() => setExpanded(expanded === snap.id ? null : snap.id)} className="flex items-center px-5 py-3 border-b border-cyan-900/20 hover:bg-surface-highest/20 transition-colors cursor-pointer">
              <span className="w-44 font-code text-[13px] text-primary font-bold">{snap.id}</span>
              <div className="w-44 flex items-center gap-2">
                <span className="font-code text-[13px] text-on-surface">{snap.set_name}</span>
              </div>
              <span className="flex-1 font-code text-[13px] text-on-surface-variant">{new Date(snap.created_at).toLocaleString()}</span>
              <span className="w-24 text-right font-code text-[13px] text-on-surface">{formatSize(snap.total_size)}</span>
              <span className="w-10 flex justify-center"><span className="material-symbols-outlined text-[16px] text-slate-500">{expanded === snap.id ? 'expand_less' : 'expand_more'}</span></span>
            </div>

            {expanded === snap.id && snap.entries.length > 0 && (
              <div className="bg-surface-lowest/30 border-b border-cyan-900/20 px-5 py-3">
                <span className="block font-code text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Archived Files</span>
                <div className="max-h-48 overflow-y-auto pr-2">
                  {snap.entries.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-cyan-900/10 last:border-0">
                      <span className="font-code text-[12px] text-on-surface-variant truncate mr-4 flex-1" title={f.original_path}>{f.original_path}</span>
                      <span className="font-code text-[11px] text-slate-500 shrink-0">{formatSize(f.size)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleRestore(snap)} className="flex-1 bg-surface-highest hover:bg-surface-bright text-on-surface-variant border border-outline-variant font-code text-[10px] font-bold py-2 rounded-sm transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">settings_backup_restore</span>Restore Files
                  </button>
                  <button onClick={() => setDeleteTarget(snap.backup_dir)} className="flex-1 bg-surface-highest hover:bg-error/20 hover:text-error hover:border-error/50 text-on-surface-variant border border-outline-variant font-code text-[10px] font-bold py-2 rounded-sm transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">delete</span>Delete Backup
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Backup"
          message="Are you sure you want to permanently delete this backup? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
