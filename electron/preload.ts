import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('dotman', {
  // Registry
  registry: {
    load: () => ipcRenderer.invoke('registry:load'),
    save: (data: unknown) => ipcRenderer.invoke('registry:save', data),
  },

  // System detection
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    isHyprlandRunning: () => ipcRenderer.invoke('system:isHyprlandRunning'),
    getDistro: () => ipcRenderer.invoke('system:getDistro'),
  },

  // Backup
  backup: {
    create: (setId: string, files: string[]) => ipcRenderer.invoke('backup:create', setId, files),
    restore: (backupPath: string, targetPath: string) => ipcRenderer.invoke('backup:restore', backupPath, targetPath),
    list: () => ipcRenderer.invoke('backup:list'),
    delete: (backupDir: string) => ipcRenderer.invoke('backup:delete', backupDir),
    quickSave: (setId: string) => ipcRenderer.invoke('backup:quickSave', setId),
  },

  // Install
  install: {
    fetchManifest: (url: string, method: string, branch?: string, targetBase?: string) => ipcRenderer.invoke('install:fetchManifest', url, method, branch, targetBase),
    execute: (config: unknown) => ipcRenderer.invoke('install:execute', config),
    abort: (taskId: string) => ipcRenderer.invoke('install:abort', taskId),
  },

  // Uninstall
  uninstall: {
    execute: (setId: string) => ipcRenderer.invoke('uninstall:execute', setId),
  },

  // Keybindings
  keybindings: {
    scan: (setId?: string) => ipcRenderer.invoke('keybindings:scan', setId),
  },

  // Shell (safe wrappers)
  shell: {
    reloadHyprland: () => ipcRenderer.invoke('shell:reloadHyprland'),
    reloadWaybar: () => ipcRenderer.invoke('shell:reloadWaybar'),
  },

  // Update
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (url: string) => ipcRenderer.invoke('update:download', url),
  },
});
