import { contextBridge, ipcRenderer } from 'electron'
import path from 'path'

const dbPath = path.join(__dirname, '..', 'data', 'executive.db')

contextBridge.exposeInMainWorld('api', {
  db: {
    getDbPath: () => dbPath,
    executeQuery: (query, params = []) => {
      return ipcRenderer.invoke('execute-query', query, params)
    }
  }
})