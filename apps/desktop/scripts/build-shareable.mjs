import { spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(__dirname, "..");
const repoRoot = resolve(desktopDir, "../..");
const builderConfigPath = resolve(desktopDir, "electron-builder.config.cjs");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveBunExecutable() {
  if (basename(process.execPath).toLowerCase().startsWith("bun")) {
    return process.execPath;
  }

  const locator = process.platform === "win32" ? "where" : "which";
  const candidates = process.platform === "win32" ? ["bun.exe", "bun.cmd", "bun"] : ["bun"];

  for (const candidate of candidates) {
    const result = spawnSync(locator, [candidate], { encoding: "utf8" });
    if (result.status === 0) {
      const resolvedPath = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);

      if (resolvedPath) {
        return resolvedPath;
      }
    }
  }

  throw new Error("Could not resolve the Bun executable required for desktop packaging.");
}

const bunExecutable = resolveBunExecutable();

run(bunExecutable, ["run", "--cwd", repoRoot, "build:desktop"]);
run(bunExecutable, ["run", "--cwd", resolve(repoRoot, "apps/server"), "build"]);
run(
  bunExecutable,
  ["x", "electron-builder", "--config", builderConfigPath, "--publish", "never", ...process.argv.slice(2)],
  {
    cwd: desktopDir,
    env: {
      ...process.env,
      BUN_EXECUTABLE: bunExecutable,
    },
  },
);
