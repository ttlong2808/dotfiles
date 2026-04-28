import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Statusbar from './components/layout/Statusbar';
import InstalledSets from './pages/InstalledSets';
import InstallNew from './pages/InstallNew';
import KeybindingsViewer from './pages/KeybindingsViewer';
import BackupManager from './pages/BackupManager';

export type Page = 'installed' | 'install' | 'keybindings' | 'backups';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('installed');

  const renderPage = () => {
    switch (currentPage) {
      case 'installed':
        return <InstalledSets onNavigate={setCurrentPage} />;
      case 'install':
        return <InstallNew onNavigate={setCurrentPage} />;
      case 'keybindings':
        return <KeybindingsViewer />;
      case 'backups':
        return <BackupManager />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-background">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-screen relative ml-64">
        <Topbar currentPage={currentPage} />

        <div className="flex-1 overflow-y-auto p-6 pb-16">
          {renderPage()}
        </div>

        <Statusbar />
      </main>
    </div>
  );
}
