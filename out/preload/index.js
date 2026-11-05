"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  ping: () => electron.ipcRenderer.invoke("ping"),
  onDataChanged: (callback) => {
    const subscription = (_event, value) => callback(value);
    electron.ipcRenderer.on("data:changed", subscription);
    return () => electron.ipcRenderer.removeListener("data:changed", subscription);
  }
});
