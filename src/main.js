import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { Database } from './backend/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow
let tray

// Initialize database
const dbPath = path.join(__dirname, '..', 'data', 'executive.db')
const db = new Database(dbPath)

// IPC handler for database queries
ipcMain.handle('execute-query', async (event, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.getDb().run(query, params, function(err) {
      if (err) {
        reject(err)
      } else {
        const stmt = this
        const rows = []
        for (let row; (row = stmt.get()); ) {
          rows.push(row)
        }
        resolve(rows)
      }
    })
  })
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/favicon.ico')
  tray = new Tray(nativeImage.createFromPath(iconPath))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) mainWindow.hide()
          else mainWindow.show()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => app.quit()
    }
  ])

  tray.setToolTip('Executive')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide()
      else mainWindow.show()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})