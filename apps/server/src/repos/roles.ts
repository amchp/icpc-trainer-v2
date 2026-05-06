import { Context, Effect, Layer } from "effect";
import { and, eq } from "drizzle-orm";

import { PersistenceError } from "../errors/persistence.ts";
import { nowIso } from "../lib/time.ts";
import { DatabaseService } from "../db/client.ts";
import { userRoles } from "../db/schema.ts";

export interface RoleAssignmentInput {
  readonly userId: number;
  readonly role: string;
  readonly position: number | null;
}

export interface RoleRepositoryShape {
  readonly assign: (input: RoleAssignmentInput) => Effect.Effect<void, PersistenceError>;
  readonly remove: (userId: number, role: string) => Effect.Effect<void, PersistenceError>;
  readonly replaceRoster: (
    role: string,
    entries: ReadonlyArray<{
      readonly userId: number;
      readonly position: number;
    }>,
  ) => Effect.Effect<void, PersistenceError>;
}

export class RoleRepository extends Context.Tag("icpc-trainer/RoleRepository")<
  RoleRepository,
  RoleRepositoryShape
>() {}

export const makeRoleRepository = Effect.gen(function* () {
  const database = yield* DatabaseService;

  return RoleRepository.of({
    assign: (input) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          database.db
            .insert(userRoles)
            .values({
              userId: input.userId,
              role: input.role,
              position: input.position,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            .onConflictDoUpdate({
              target: [userRoles.userId, userRoles.role],
              set: {
                position: input.position,
                updatedAt: timestamp,
              },
            })
            .run();
        },
        catch: (error) =>
          new PersistenceError({
            code: "role_assign_failed",
            message: error instanceof Error ? error.message : "Failed to assign user role.",
          }),
      }),
    remove: (userId, role) =>
      Effect.try({
        try: () => {
          database.db
            .delete(userRoles)
            .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
            .run();
        },
        catch: (error) =>
          new PersistenceError({
            code: "role_remove_failed",
            message: error instanceof Error ? error.message : "Failed to remove user role.",
          }),
      }),
    replaceRoster: (role, entries) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          database.db.transaction((tx) => {
            tx.delete(userRoles).where(eq(userRoles.role, role)).run();

            if (entries.length === 0) {
              return;
            }

            tx.insert(userRoles)
              .values(
                entries.map((entry) => ({
                  userId: entry.userId,
                  role,
                  position: entry.position,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })),
              )
              .run();
          });
        },
        catch: (error) =>
          new PersistenceError({
            code: "role_replace_roster_failed",
            message: error instanceof Error ? error.message : `Failed to replace roster ${role}.`,
          }),
      }),
  });
});

export const RoleRepositoryLive = Layer.effect(RoleRepository, makeRoleRepository);
