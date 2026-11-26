const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("strive", {
  alert: () => ipcRenderer.send("strive-alert"),
  stop: () => ipcRenderer.send("strive-stop")
});
