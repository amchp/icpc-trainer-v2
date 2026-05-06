import { Context, Effect, Layer } from "effect";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { PersistenceError } from "../errors/persistence.ts";
import { USER_PROVIDER } from "../lib/constants.ts";
import { nowIso } from "../lib/time.ts";
import { DatabaseService } from "../db/client.ts";
import { userRoles, users } from "../db/schema.ts";

export interface UpsertUserInput {
  readonly providerUserKey: string;
  readonly username: string;
  readonly lastProgressSyncedAt?: string | null;
}

export interface UserRepositoryShape {
  readonly upsertCodeforcesUser: (
    input: UpsertUserInput,
  ) => Effect.Effect<typeof users.$inferSelect, PersistenceError>;
  readonly findById: (
    id: number,
  ) => Effect.Effect<typeof users.$inferSelect | null, PersistenceError>;
  readonly findByHandle: (
    handle: string,
  ) => Effect.Effect<typeof users.$inferSelect | null, PersistenceError>;
  readonly listByRole: (
    role: string,
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly user: typeof users.$inferSelect;
      readonly position: number | null;
      readonly roleUpdatedAt: string | null;
    }>,
    PersistenceError
  >;
  readonly listByRoles: (
    roles: ReadonlyArray<string>,
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly user: typeof users.$inferSelect;
      readonly role: string;
      readonly position: number | null;
    }>,
    PersistenceError
  >;
  readonly touchLastProgressSyncedAt: (
    userId: number,
    timestamp: string,
  ) => Effect.Effect<void, PersistenceError>;
}

export class UserRepository extends Context.Tag("icpc-trainer/UserRepository")<
  UserRepository,
  UserRepositoryShape
>() {}

export const makeUserRepository = Effect.gen(function* () {
  const database = yield* DatabaseService;

  return UserRepository.of({
    upsertCodeforcesUser: (input) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          database.db
            .insert(users)
            .values({
              provider: USER_PROVIDER,
              providerUserKey: input.providerUserKey,
              username: input.username,
              createdAt: timestamp,
              updatedAt: timestamp,
              lastProgressSyncedAt: input.lastProgressSyncedAt ?? null,
            })
            .onConflictDoUpdate({
              target: [users.provider, users.providerUserKey],
              set: {
                username: input.username,
                updatedAt: timestamp,
                lastProgressSyncedAt:
                  input.lastProgressSyncedAt === undefined
                    ? sql`${users.lastProgressSyncedAt}`
                    : input.lastProgressSyncedAt,
              },
            })
            .run();

          const user = database.db
            .select()
            .from(users)
            .where(
              and(
                eq(users.provider, USER_PROVIDER),
                eq(users.providerUserKey, input.providerUserKey),
              ),
            )
            .get();

          if (!user) {
            throw new Error(`User ${input.providerUserKey} was not found after upsert.`);
          }

          return user;
        },
        catch: (error) =>
          new PersistenceError({
            code: "user_upsert_failed",
            message: error instanceof Error ? error.message : "Failed to upsert user.",
          }),
      }),
    findById: (id) =>
      Effect.try({
        try: () =>
          database.db.select().from(users).where(eq(users.id, id)).get() ?? null,
        catch: (error) =>
          new PersistenceError({
            code: "user_find_by_id_failed",
            message: error instanceof Error ? error.message : `Failed to load user ${id}.`,
          }),
      }),
    findByHandle: (handle) =>
      Effect.try({
        try: () =>
          database.db
            .select()
            .from(users)
            .where(sql`lower(${users.username}) = lower(${handle})`)
            .get() ?? null,
        catch: (error) =>
          new PersistenceError({
            code: "user_find_by_handle_failed",
            message: error instanceof Error ? error.message : `Failed to load handle ${handle}.`,
          }),
      }),
    listByRole: (role) =>
      Effect.try({
        try: () =>
          database.db
            .select({
              user: users,
              position: userRoles.position,
              roleUpdatedAt: userRoles.updatedAt,
            })
            .from(userRoles)
            .innerJoin(users, eq(users.id, userRoles.userId))
            .where(eq(userRoles.role, role))
            .orderBy(asc(userRoles.position), asc(users.username))
            .all(),
        catch: (error) =>
          new PersistenceError({
            code: "user_list_by_role_failed",
            message: error instanceof Error ? error.message : `Failed to load role ${role}.`,
          }),
      }),
    listByRoles: (roles) =>
      Effect.try({
        try: () => {
          if (roles.length === 0) {
            return [];
          }

          return database.db
            .select({
              user: users,
              role: userRoles.role,
              position: userRoles.position,
            })
            .from(userRoles)
            .innerJoin(users, eq(users.id, userRoles.userId))
            .where(inArray(userRoles.role, [...roles]))
            .orderBy(asc(userRoles.role), asc(userRoles.position), asc(users.username))
            .all();
        },
        catch: (error) =>
          new PersistenceError({
            code: "user_list_by_roles_failed",
            message: error instanceof Error ? error.message : "Failed to load role users.",
          }),
      }),
    touchLastProgressSyncedAt: (userId, timestamp) =>
      Effect.try({
        try: () => {
          database.db
            .update(users)
            .set({
              lastProgressSyncedAt: timestamp,
              updatedAt: timestamp,
            })
            .where(eq(users.id, userId))
            .run();
        },
        catch: (error) =>
          new PersistenceError({
            code: "user_touch_sync_failed",
            message:
              error instanceof Error
                ? error.message
                : `Failed to update last sync timestamp for user ${userId}.`,
          }),
      }),
  });
});

export const UserRepositoryLive = Layer.effect(UserRepository, makeUserRepository);
