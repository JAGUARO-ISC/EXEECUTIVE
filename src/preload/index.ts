import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  onDataChanged: (callback: (data: unknown) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value)
    ipcRenderer.on('data:changed', subscription)
    return () => ipcRenderer.removeListener('data:changed', subscription)
  }
})

