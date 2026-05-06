import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";

import { PersistenceError } from "../errors/persistence.ts";
import { nowIso } from "../lib/time.ts";
import { DatabaseService } from "../db/client.ts";
import { appCacheState } from "../db/schema.ts";

export interface CacheRepositoryShape {
  readonly get: (
    key: string,
  ) => Effect.Effect<{ readonly key: string; readonly value: string | null; readonly updatedAt: string } | null, PersistenceError>;
  readonly set: (key: string, value: string | null) => Effect.Effect<void, PersistenceError>;
  readonly getJson: <T>(key: string) => Effect.Effect<T | null, PersistenceError>;
  readonly setJson: <T>(key: string, value: T) => Effect.Effect<void, PersistenceError>;
}

export class CacheRepository extends Context.Tag("icpc-trainer/CacheRepository")<
  CacheRepository,
  CacheRepositoryShape
>() {}

export const makeCacheRepository = Effect.gen(function* () {
  const database = yield* DatabaseService;

  return CacheRepository.of({
    get: (key) =>
      Effect.try({
        try: () =>
          database.db
            .select()
            .from(appCacheState)
            .where(eq(appCacheState.key, key))
            .get() ?? null,
        catch: (error) =>
          new PersistenceError({
            code: "cache_get_failed",
            message: error instanceof Error ? error.message : `Failed to read cache key ${key}.`,
          }),
      }),
    set: (key, value) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          database.db
            .insert(appCacheState)
            .values({
              key,
              value,
              updatedAt: timestamp,
            })
            .onConflictDoUpdate({
              target: appCacheState.key,
              set: {
                value,
                updatedAt: timestamp,
              },
            })
            .run();
        },
        catch: (error) =>
          new PersistenceError({
            code: "cache_set_failed",
            message: error instanceof Error ? error.message : `Failed to write cache key ${key}.`,
          }),
      }),
    getJson: <T>(key: string) =>
      Effect.try({
        try: () => {
          const row =
            database.db
              .select()
              .from(appCacheState)
              .where(eq(appCacheState.key, key))
              .get() ?? null;
          return row?.value ? (JSON.parse(row.value) as T) : null;
        },
        catch: (error) =>
          new PersistenceError({
            code: "cache_get_json_failed",
            message:
              error instanceof Error ? error.message : `Failed to read JSON cache key ${key}.`,
          }),
      }),
    setJson: <T>(key: string, value: T) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          database.db
            .insert(appCacheState)
            .values({
              key,
              value: JSON.stringify(value),
              updatedAt: timestamp,
            })
            .onConflictDoUpdate({
              target: appCacheState.key,
              set: {
                value: JSON.stringify(value),
                updatedAt: timestamp,
              },
            })
            .run();
        },
        catch: (error) =>
          new PersistenceError({
            code: "cache_set_json_failed",
            message:
              error instanceof Error ? error.message : `Failed to write JSON cache key ${key}.`,
          }),
      }),
  });
});

export const CacheRepositoryLive = Layer.effect(CacheRepository, makeCacheRepository);
