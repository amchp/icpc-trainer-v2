import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";

import { APP_SESSION_ID } from "../lib/constants.ts";
import { nowIso } from "../lib/time.ts";
import { PersistenceError } from "../errors/persistence.ts";
import { DatabaseService } from "../db/client.ts";
import { appSession } from "../db/schema.ts";

export interface SaveSessionInput {
  readonly currentUserId: number;
  readonly currentHandle: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly authenticatedAt: string;
  readonly lastValidatedAt: string;
}

export interface SessionRepositoryShape {
  readonly get: () => Effect.Effect<typeof appSession.$inferSelect | null, PersistenceError>;
  readonly save: (input: SaveSessionInput) => Effect.Effect<void, PersistenceError>;
  readonly clear: () => Effect.Effect<void, PersistenceError>;
}

export class SessionRepository extends Context.Tag("icpc-trainer/SessionRepository")<
  SessionRepository,
  SessionRepositoryShape
>() {}

export const makeSessionRepository = Effect.gen(function* () {
  const database = yield* DatabaseService;

  return SessionRepository.of({
    get: () =>
      Effect.try({
        try: () =>
          database.db
            .select()
            .from(appSession)
            .where(eq(appSession.id, APP_SESSION_ID))
            .get() ?? null,
        catch: (error) =>
          new PersistenceError({
            code: "session_get_failed",
            message: error instanceof Error ? error.message : "Failed to read app session.",
          }),
      }),
    save: (input) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          database.db
            .insert(appSession)
            .values({
              id: APP_SESSION_ID,
              currentUserId: input.currentUserId,
              currentHandle: input.currentHandle,
              apiKey: input.apiKey,
              apiSecret: input.apiSecret,
              authenticatedAt: input.authenticatedAt,
              lastValidatedAt: input.lastValidatedAt,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            .onConflictDoUpdate({
              target: appSession.id,
              set: {
                currentUserId: input.currentUserId,
                currentHandle: input.currentHandle,
                apiKey: input.apiKey,
                apiSecret: input.apiSecret,
                authenticatedAt: input.authenticatedAt,
                lastValidatedAt: input.lastValidatedAt,
                updatedAt: timestamp,
              },
            })
            .run();
        },
        catch: (error) =>
          new PersistenceError({
            code: "session_save_failed",
            message: error instanceof Error ? error.message : "Failed to persist app session.",
          }),
      }),
    clear: () =>
      Effect.try({
        try: () => {
          database.db.delete(appSession).where(eq(appSession.id, APP_SESSION_ID)).run();
        },
        catch: (error) =>
          new PersistenceError({
            code: "session_clear_failed",
            message: error instanceof Error ? error.message : "Failed to clear app session.",
          }),
      }),
  });
});

export const SessionRepositoryLive = Layer.effect(SessionRepository, makeSessionRepository);
