import { existsSync } from "node:fs";
import Path from "node:path";
import { app, BrowserWindow, shell } from "electron";

const devServerUrl = process.env.VITE_DEV_SERVER_URL?.trim();
const isDevelopment = Boolean(devServerUrl);
const webBuildEntry = Path.resolve(__dirname, "../../web/dist/client/index.html");

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      preload: Path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDevelopment) {
    void window.loadURL(devServerUrl!);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  if (!existsSync(webBuildEntry)) {
    throw new Error(`Missing web build at ${webBuildEntry}. Run bun --cwd apps/web run build first.`);
  }

  void window.loadFile(webBuildEntry);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

