import { Context, Effect, Layer } from "effect";

import { CacheRepository } from "../repos/cache.ts";
import { CodeforcesClient } from "./codeforcesClient.ts";
import { CACHE_KEYS, CATALOG_STALE_MS } from "../lib/constants.ts";
import { isStale, nowIso } from "../lib/time.ts";
import { SyncError } from "../errors/sync.ts";

const GYM_CONTEST_ID_START = 100_000;

export interface CatalogSnapshot {
  readonly gymCatalog: ReadonlyMap<number, import("./codeforcesClient.ts").CodeforcesContest>;
  readonly regularCatalog: ReadonlyMap<number, import("./codeforcesClient.ts").CodeforcesContest>;
  readonly problemset: import("./codeforcesClient.ts").CodeforcesProblemsetPayload;
}

export interface CatalogSyncServiceShape {
  readonly syncCatalogsIfStale: (
    force?: boolean,
  ) => Effect.Effect<CatalogSnapshot, SyncError>;
}

export class CatalogSyncService extends Context.Tag("icpc-trainer/CatalogSyncService")<
  CatalogSyncService,
  CatalogSyncServiceShape
>() {}

export const makeCatalogSyncService = Effect.gen(function* () {
  const cacheRepository = yield* CacheRepository;
  const codeforcesClient = yield* CodeforcesClient;

  const syncCatalogsIfStale = Effect.fn("catalogSync.syncCatalogsIfStale")(function* (
    force = false,
  ) {
    const gymCache = yield* cacheRepository.get(CACHE_KEYS.gymCatalogLastSyncedAt).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "gym_catalog_cache_load_failed",
            message: error.message,
          }),
      ),
    );
    const regularCache = yield* cacheRepository.get(CACHE_KEYS.regularCatalogLastSyncedAt).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "regular_catalog_cache_load_failed",
            message: error.message,
          }),
      ),
    );
    const problemsetCache = yield* cacheRepository.get(CACHE_KEYS.problemsetLastSyncedAt).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "problemset_cache_load_failed",
            message: error.message,
          }),
      ),
    );
    const cachedContestPayload = yield* cacheRepository
      .getJson<ReadonlyArray<import("./codeforcesClient.ts").CodeforcesContest>>(
        CACHE_KEYS.contestCatalogPayload,
      )
      .pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "contest_catalog_payload_cache_load_failed",
              message: error.message,
            }),
        ),
      );

    if (
      force ||
      isStale(gymCache?.updatedAt, CATALOG_STALE_MS) ||
      !cachedContestPayload ||
      cachedContestPayload.every((contest) => contest.id < GYM_CONTEST_ID_START)
    ) {
      const gymCatalog = yield* codeforcesClient.getGymContestCatalog().pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "gym_catalog_sync_failed",
              message: error.message,
            }),
        ),
      );
      yield* cacheRepository.setJson(
        CACHE_KEYS.contestCatalogPayload,
        [...gymCatalog.values()],
      ).pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "contest_catalog_payload_cache_failed",
              message: error.message,
            }),
        ),
      );
      yield* cacheRepository.set(CACHE_KEYS.gymCatalogLastSyncedAt, nowIso()).pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "gym_catalog_cache_failed",
              message: error.message,
            }),
        ),
      );
    }

    if (force || isStale(problemsetCache?.updatedAt, CATALOG_STALE_MS)) {
      yield* codeforcesClient.getProblemsetProblems().pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "problemset_sync_failed",
              message: error.message,
            }),
        ),
      );
      yield* cacheRepository.set(CACHE_KEYS.problemsetLastSyncedAt, nowIso()).pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "problemset_cache_failed",
              message: error.message,
            }),
        ),
      );
    }

    const [gymCatalog, problemset] = yield* Effect.all([
      codeforcesClient.getGymContestCatalog(),
      codeforcesClient.getProblemsetProblems(),
    ]).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "catalog_load_failed",
            message: error.message,
        }),
      ),
    );

    return {
      gymCatalog,
      regularCatalog: new Map(),
      problemset,
    } satisfies CatalogSnapshot;
  });

  return CatalogSyncService.of({
    syncCatalogsIfStale,
  });
});

export const CatalogSyncServiceLive = Layer.effect(
  CatalogSyncService,
  makeCatalogSyncService,
);
