export function nowIso() {
  return new Date().toISOString();
}

export function nowUnixSeconds() {
  return Math.floor(Date.now() / 1_000);
}

export function isStale(timestamp: string | null | undefined, maxAgeMs: number) {
  if (!timestamp) {
    return true;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return true;
  }

  return Date.now() - parsed >= maxAgeMs;
}
