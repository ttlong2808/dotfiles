import { useEffect, useState } from 'react';
import type { SystemInfo } from '../../types/dotman.d';

export default function Statusbar() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    window.dotman.system.getInfo().then(res => {
      if (res.ok && res.data) {
        setSysInfo(res.data);
      }
    }).catch(console.error);
  }, []);

  const status = sysInfo?.hyprland_running ? 'OPTIMAL' : 'DEGRADED';
  const hyprVersion = sysInfo?.hyprland_version ? `v${sysInfo.hyprland_version}` : 'N/A';
  const distro = sysInfo?.distro.id || 'unknown';

  return (
    <footer className="fixed bottom-0 right-0 left-64 flex justify-between items-center px-4 bg-[#0a2a2a] h-6 border-t border-cyan-800/40 z-40">
      <span className="text-cyan-500 font-code text-[9px] font-bold uppercase tracking-wider">
        SYSTEM: {status} // HYPRLAND {hyprVersion}
      </span>
      <div className="flex items-center gap-4 text-cyan-700 font-code text-[9px] font-bold uppercase">
        {sysInfo && <span>{sysInfo.username}@{sysInfo.hostname}</span>}
        <span>distro: {distro}</span>
        <span>utf-8</span>
      </div>
    </footer>
  );
}
