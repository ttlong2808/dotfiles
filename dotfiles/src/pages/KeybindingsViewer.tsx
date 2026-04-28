import { useState, useEffect } from 'react';

interface Keybinding {
  modifiers: string[];
  key: string;
  dispatcher: string;
  action: string;
  category: string;
  bind_type: string;
  source_file: string;
  line_number: number;
  origin_set: string;
}

export default function KeybindingsViewer() {
  const [search, setSearch] = useState('');
  const [bindings, setBindings] = useState<Keybinding[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBindings = async () => {
    try {
      setLoading(true);
      const res = await window.dotman.keybindings.scan();
      if (res.ok && res.data) {
        setBindings((res.data as any).bindings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBindings();
  }, []);

  const cats = [...new Set(bindings.map(b => b.category))];
  const filtered = bindings.filter(b => !search || b.action.toLowerCase().includes(search.toLowerCase()) || b.key.toLowerCase().includes(search.toLowerCase()) || b.dispatcher.toLowerCase().includes(search.toLowerCase()));
  const grouped: Record<string, Keybinding[]> = {};
  for (const b of filtered) { grouped[b.category] = grouped[b.category] || []; grouped[b.category].push(b); }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 border-b border-cyan-900/30 pb-4">
        <div>
          <h1 className="text-[32px] font-bold text-on-background leading-tight tracking-tight">Keybindings Viewer</h1>
          <p className="font-code text-[12px] text-on-surface-variant mt-1 tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">database</span>
            REGISTRY: ~/.config/hypr/hyprland.conf // LOADED: {bindings.length} BINDINGS
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={loadBindings} className="bg-surface-highest hover:bg-surface-bright text-on-surface-variant border border-outline-variant font-code text-[11px] font-bold px-4 py-2 rounded-sm transition-colors uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">refresh</span>Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 bg-surface-mid/50 border border-cyan-900/50 rounded-sm p-3">
        <span className="material-symbols-outlined text-[18px] text-slate-500">search</span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="FILTER BINDINGS BY KEY, ACTION, OR DISPATCHER..." className="flex-1 bg-transparent text-[13px] text-on-surface placeholder:text-slate-600 focus:outline-none font-code tracking-wide" />
      </div>

      <div className="bg-surface-mid/50 border border-cyan-900/50 rounded-sm overflow-hidden">
        <div className="flex items-center px-5 py-2.5 border-b border-cyan-900/40 font-code text-[10px] text-slate-500 uppercase tracking-widest font-bold bg-surface-highest/30">
          <span className="w-40">Dispatcher</span><span className="w-56">Key Combo</span><span className="flex-1">Action Command</span><span className="w-24">Origin Set</span>
        </div>
        
        {loading ? (
          <div className="py-10 text-center"><span className="material-symbols-outlined text-[32px] text-slate-500 animate-spin">sync</span></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="py-10 text-center text-slate-500 font-code text-[12px]">No keybindings found.</div>
        ) : Object.entries(grouped).map(([cat, binds]) => (
          <div key={cat}>
            <div className="flex items-center gap-2 px-5 py-2 bg-surface-highest/50 border-b border-cyan-900/20 border-l-2 border-l-primary/50">
              <span className="material-symbols-outlined text-[14px] text-primary">grid_view</span>
              <span className="font-code text-[10px] font-bold text-primary uppercase tracking-widest">{cat}</span>
            </div>
            {binds.map((b, i) => (
              <div key={i} className="flex items-center px-5 py-3 border-b border-cyan-900/15 hover:bg-surface-highest/20 transition-colors">
                <span className="w-40 font-code text-[13px] text-on-surface-variant">{b.dispatcher}</span>
                <div className="w-56 flex items-center gap-1">
                  {b.modifiers.map((m, mi) => (<span key={mi}><span className="inline-block px-2 py-0.5 border border-outline-variant rounded-sm font-code text-[11px] text-on-surface-variant bg-surface-highest/50">{m}</span><span className="text-slate-600 mx-0.5 text-[11px]">+</span></span>))}
                  <span className="inline-block px-2 py-0.5 border border-outline-variant rounded-sm font-code text-[11px] text-on-surface bg-surface-highest/50">{b.key}</span>
                </div>
                <span className="flex-1 font-code text-[13px] text-on-surface">{b.action}</span>
                <span className={`w-24 font-code text-[12px] ${b.origin_set === 'User' ? 'text-primary italic' : 'text-slate-500'}`} title={b.source_file}>{b.origin_set}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="px-5 py-4 text-center font-code text-[11px] text-slate-600 tracking-widest uppercase">-- END OF REGISTRY --</div>
      </div>
    </div>
  );
}
