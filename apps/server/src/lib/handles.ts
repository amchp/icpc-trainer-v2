import { MAX_ROSTER_SIZE } from "./constants.ts";

export const CODEFORCES_HANDLE_PATTERN = /^[A-Za-z0-9_.-]{1,24}$/;

export function normalizeHandleKey(handle: string) {
  return handle.trim().toLowerCase();
}

export function isValidCodeforcesHandle(handle: string) {
  return CODEFORCES_HANDLE_PATTERN.test(handle.trim());
}

export function normalizeUniqueHandles(handles: ReadonlyArray<string>) {
  const normalizedHandles: string[] = [];
  const invalidHandles: string[] = [];
  const seen = new Set<string>();

  for (const handle of handles) {
    const trimmed = handle.trim();
    if (!trimmed) {
      continue;
    }

    if (!isValidCodeforcesHandle(trimmed)) {
      invalidHandles.push(trimmed);
      continue;
    }

    const key = normalizeHandleKey(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedHandles.push(trimmed);
  }

  return {
    invalidHandles,
    normalizedHandles,
    exceedsMaxSize: normalizedHandles.length > MAX_ROSTER_SIZE,
  };
}
