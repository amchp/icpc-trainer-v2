import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import Path from "node:path";
import { app, BrowserWindow, dialog, shell } from "electron";

const devServerUrl = process.env.VITE_DEV_SERVER_URL?.trim();
const isDevelopment = Boolean(devServerUrl);
const packagedResourcesDir = process.resourcesPath;
const webDistDir = app.isPackaged
  ? Path.join(packagedResourcesDir, "web", "dist")
  : Path.resolve(__dirname, "../../web/dist");
const webClientDir = Path.join(webDistDir, "client");
const webServerEntry = Path.join(webDistDir, "server", "server.js");
const apiPort = Number(process.env.ICPC_TRAINER_API_PORT ?? 4123);
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webPort = Number(process.env.ICPC_TRAINER_WEB_PORT ?? 4124);
const webBaseUrl = `http://127.0.0.1:${webPort}`;
const serverCwd = app.isPackaged
  ? Path.join(packagedResourcesDir, "server")
  : Path.resolve(__dirname, "../../server");
const serverEntry = app.isPackaged
  ? Path.join(serverCwd, "dist-bun", "main.js")
  : Path.resolve(serverCwd, "src/main.ts");
const bundledBunExecutable = app.isPackaged
  ? Path.join(packagedResourcesDir, "bin", process.platform === "win32" ? "bun.exe" : "bun")
  : "bun";

let backendProcess: ChildProcess | null = null;
let webServer: Server | null = null;
let isQuitting = false;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attachBackendLogs(process: ChildProcess) {
  process.stdout?.on("data", (chunk) => {
    console.log(`[backend] ${String(chunk).trimEnd()}`);
  });
  process.stderr?.on("data", (chunk) => {
    console.error(`[backend] ${String(chunk).trimEnd()}`);
  });
}

async function checkBackendHealth() {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  if (!response.ok) {
    throw new Error(`Backend health check failed with status ${response.status}.`);
  }

  return response.json() as Promise<{
    startupSyncReady?: boolean;
  }>;
}

async function checkWebHealth() {
  const response = await fetch(webBaseUrl);
  if (!response.ok) {
    throw new Error(`Web health check failed with status ${response.status}.`);
  }
}

function startBackend() {
  if (backendProcess) {
    return backendProcess;
  }

  if (app.isPackaged && !existsSync(bundledBunExecutable)) {
    throw new Error(`Bundled Bun runtime not found at ${bundledBunExecutable}.`);
  }

  const databaseUrl =
    process.env.DATABASE_URL?.trim()
    || (app.isPackaged ? Path.join(app.getPath("userData"), "icpc-trainer.db") : undefined);
  const drizzleDir = app.isPackaged ? Path.join(serverCwd, "drizzle") : undefined;

  const child = spawn(bundledBunExecutable, [serverEntry], {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(apiPort),
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
      ...(drizzleDir ? { ICPC_TRAINER_DRIZZLE_DIR: drizzleDir } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  attachBackendLogs(child);

  child.once("exit", (code, signal) => {
    backendProcess = null;
    if (!isQuitting) {
      console.error(`Backend exited early (code=${code}, signal=${signal ?? "none"}).`);
    }
  });

  backendProcess = child;
  return child;
}

function toRequestUrl(request: IncomingMessage) {
  return new URL(request.url ?? "/", webBaseUrl);
}

function resolveStaticContentType(filePath: string) {
  const extension = Path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".png":
      return "image/png";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function tryResolveStaticAsset(request: IncomingMessage) {
  const pathname = decodeURIComponent(toRequestUrl(request).pathname);
  const relativePath = pathname.replace(/^\/+/, "");
  const candidatePath = Path.resolve(webClientDir, relativePath);

  if (!candidatePath.startsWith(`${webClientDir}${Path.sep}`) && candidatePath !== webClientDir) {
    return null;
  }

  if (!existsSync(candidatePath)) {
    return null;
  }

  const stats = statSync(candidatePath);
  if (!stats.isFile()) {
    return null;
  }

  return candidatePath;
}

function serveStaticAsset(filePath: string, response: ServerResponse) {
  response.statusCode = 200;
  response.setHeader("Content-Type", resolveStaticContentType(filePath));
  createReadStream(filePath).pipe(response);
}

function toRequestBody(request: IncomingMessage) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  return request;
}

async function pipeWebResponse(response: Response, serverResponse: ServerResponse) {
  serverResponse.statusCode = response.status;
  serverResponse.statusMessage = response.statusText;

  response.headers.forEach((value, key) => {
    serverResponse.setHeader(key, value);
  });

  if (!response.body) {
    serverResponse.end();
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    serverResponse.write(value);
  }

  serverResponse.end();
}

async function createWebRequestHandler() {
  const webModule = (await import(webServerEntry)) as {
    default?: {
      fetch: (request: Request) => Promise<Response>;
    };
  };

  const handler = webModule.default;
  if (!handler?.fetch) {
    throw new Error(`Web server bundle at ${webServerEntry} does not export a fetch handler.`);
  }

  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const staticAssetPath = tryResolveStaticAsset(request);
      if (staticAssetPath) {
        serveStaticAsset(staticAssetPath, response);
        return;
      }

      const webRequest = new Request(toRequestUrl(request), {
        method: request.method,
        headers: request.headers as HeadersInit,
        body: toRequestBody(request),
        duplex: "half",
      });

      const webResponse = await handler.fetch(webRequest);
      await pipeWebResponse(webResponse, response);
    } catch (error) {
      console.error("Web renderer request failed:", error);
      response.statusCode = 500;
      response.end("Renderer server error");
    }
  };
}

async function startWebServer() {
  if (webServer) {
    return webServer;
  }

  if (!existsSync(webServerEntry)) {
    throw new Error(
      `Missing web server build at ${webServerEntry}. Run bun --cwd apps/web run build first.`,
    );
  }

  const requestHandler = await createWebRequestHandler();
  const server = createServer((request, response) => {
    void requestHandler(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(webPort, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  webServer = server;
  return server;
}

async function waitForBackendReady() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      await checkBackendHealth();
      return;
    } catch {
      // Retry until the deadline.
    }

    await delay(250);
  }

  throw new Error(`Backend did not become ready at ${apiBaseUrl}/api/health.`);
}

async function waitForWebReady() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      await checkWebHealth();
      return;
    } catch {
      // Retry until the deadline.
    }

    await delay(250);
  }

  throw new Error(`Web renderer did not become ready at ${webBaseUrl}.`);
}

async function ensureBackendReady() {
  try {
    await checkBackendHealth();
    return;
  } catch {
    startBackend();
    await waitForBackendReady();
  }
}

async function ensureWebReady() {
  try {
    await checkWebHealth();
    return;
  } catch {
    await startWebServer();
    await waitForWebReady();
  }
}

function createWindow() {
  process.env.ICPC_TRAINER_API_BASE_URL = apiBaseUrl;
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

  void window.loadURL(webBaseUrl);
}

app.whenReady().then(async () => {
  try {
    await ensureBackendReady();
    await ensureWebReady();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Desktop startup failed:", detail);
    await dialog.showMessageBox({
      type: "error",
      title: "ICPC Trainer failed to start",
      message: "The desktop app could not connect to the backend service.",
      detail,
    });
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  if (webServer) {
    webServer.close();
    webServer = null;
  }
});
