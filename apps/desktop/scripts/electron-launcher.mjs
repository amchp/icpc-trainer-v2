import { createRequire } from "node:module";

export function resolveElectronPath() {
  const require = createRequire(import.meta.url);
  return require("electron");
}
