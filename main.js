const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain } = require("electron");
const path = require("path");

app.setAppUserModelId("com.strive.app"); // нужно Windows для уведомлений

const gotLock = app.requestSingleInstanceLock();
const startHidden = process.argv.includes("--hidden");
let win, tray, quitting = false, hintShown = false;

function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function buildTrayMenu() {
  const auto = app.isPackaged ? app.getLoginItemSettings().openAtLogin : false;
  return Menu.buildFromTemplate([
    { label: "Открыть Strive", click: showWin },
    {
      label: "Запускать вместе с Windows",
      type: "checkbox",
      checked: auto,
      enabled: app.isPackaged,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--hidden"] });
        tray.setContextMenu(buildTrayMenu());
      }
    },
    { type: "separator" },
    { label: "Выход (напоминания отключатся)", click: () => { quitting = true; app.quit(); } }
  ]);
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, "icon-192.png")).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip("Strive — работает в фоне");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => (win && win.isVisible() && win.isFocused() ? win.hide() : showWin()));
}

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    show: false,
    backgroundColor: "#0b1e4a",
    icon: path.join(__dirname, "icon-512.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required", // мелодия звучит без клика
      backgroundThrottling: false                 // таймеры работают в фоне
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile("index.html");
  win.once("ready-to-show", () => { if (!startHidden) win.show(); });
  win.on("focus", () => win.flashFrame(false));

  // Крестик не закрывает приложение, а прячет его в трей
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    if (!hintShown && tray && tray.displayBalloon) {
      hintShown = true;
      try {
        tray.displayBalloon({
          title: "Strive работает в фоне",
          content: "Напоминания будут приходить. Выход — через значок у часов."
        });
      } catch (e2) {}
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// Напоминание: окно выезжает наверх (даже из трея) и мигает в панели задач
ipcMain.on("strive-alert", () => {
  if (!win) return;
  showWin();
  win.flashFrame(true);
  win.setAlwaysOnTop(true);
  setTimeout(() => { if (win) win.setAlwaysOnTop(false); }, 3000);
});
ipcMain.on("strive-stop", () => { if (win) win.flashFrame(false); });

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", showWin);
  app.on("before-quit", () => { quitting = true; });
  app.whenReady().then(() => { createTray(); createWindow(); });
}
