import path from "node:path";

const REQUIRED_ENV_NAMES = [
  "E2E_CODEFORCES_HANDLE",
  "E2E_CODEFORCES_API_KEY",
  "E2E_CODEFORCES_API_SECRET",
] as const;

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value for E2E_HEADLESS: expected true/false, got "${value}".`);
}

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric value for E2E_SLOW_MO: expected a non-negative number.`);
  }

  return parsed;
}

export function assertRequiredLiveEnv() {
  const missing = REQUIRED_ENV_NAMES.filter((name) => readEnv(name).length === 0);
  if (missing.length > 0) {
    throw new Error(`Missing required live E2E env vars: ${missing.join(", ")}`);
  }
}

export function getLiveEnv() {
  assertRequiredLiveEnv();

  return {
    handle: readEnv("E2E_CODEFORCES_HANDLE"),
    apiKey: readEnv("E2E_CODEFORCES_API_KEY"),
    apiSecret: readEnv("E2E_CODEFORCES_API_SECRET"),
    baseUrl: readEnv("E2E_BASE_URL") || "http://127.0.0.1:3000",
    apiBaseUrl: readEnv("E2E_API_BASE_URL") || "http://127.0.0.1:4000",
    headless: parseBoolean(process.env.E2E_HEADLESS, true),
    slowMo: parseNumber(process.env.E2E_SLOW_MO, 0),
    storageStatePath: path.resolve(process.cwd(), "tests/e2e/.artifacts/storage-state.json"),
  };
}
