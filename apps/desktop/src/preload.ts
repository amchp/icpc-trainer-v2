import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronApp", {
  isDesktop: true,
  apiBaseUrl: process.env.ICPC_TRAINER_API_BASE_URL ?? "http://127.0.0.1:4000",
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
});
