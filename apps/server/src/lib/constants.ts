export const USER_PROVIDER = "codeforces" as const;

export const CONTEST_PROVIDERS = [
  "codeforces.gym",
  "codeforces.contest",
] as const;

export const PARTICIPANT_ROLES = [
  "primary",
  "friend",
  "teammate",
] as const;

export const MANAGED_ROSTER_ROLES = [
  "friend",
  "teammate",
] as const;

export const CACHE_KEYS = {
  contestCatalogPayload: "contestCatalog.codeforces.payload",
  gymCatalogLastSyncedAt: "contestCatalog.codeforces.gym.lastSyncedAt",
  regularCatalogLastSyncedAt: "contestCatalog.codeforces.contest.lastSyncedAt",
  problemsetLastSyncedAt: "problemset.codeforces.contest.lastSyncedAt",
} as const;

export const HANDLE_STALE_MS = 24 * 60 * 60 * 1_000;
export const CATALOG_STALE_MS = 24 * 60 * 60 * 1_000;
export const MAX_ROSTER_SIZE = 10;
export const APP_SESSION_ID = 1;

export type ContestProvider = (typeof CONTEST_PROVIDERS)[number];
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
export type ManagedRosterRole = (typeof MANAGED_ROSTER_ROLES)[number];
export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];
