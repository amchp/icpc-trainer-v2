import { Context, Effect, Layer } from "effect";

import type { RosterResponse, SyncRosterResponse } from "../contracts/roster.ts";
import { RosterError } from "../errors/roster.ts";
import type { ManagedRosterRole } from "../lib/constants.ts";
import { RoleRepository } from "../repos/roles.ts";
import { UserRepository } from "../repos/users.ts";
import { HANDLE_STALE_MS, MAX_ROSTER_SIZE } from "../lib/constants.ts";
import { normalizeUniqueHandles } from "../lib/handles.ts";
import { isStale } from "../lib/time.ts";
import { CodeforcesClient } from "./codeforcesClient.ts";
import { HandleSyncService } from "./handleSync.ts";
import { SessionService } from "./session.ts";

function toRosterResponse(
  role: ManagedRosterRole,
  entries: ReadonlyArray<{
    readonly user: typeof import("../db/schema.ts").users.$inferSelect;
    readonly position: number | null;
    readonly roleUpdatedAt: string | null;
  }>,
): RosterResponse {
  const updatedAt = entries
    .map((entry) => entry.roleUpdatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    role,
    handles: entries.map((entry) => entry.user.username),
    entries: entries.map((entry) => ({
      role,
      position: entry.position ?? 0,
      user: {
        id: entry.user.id,
        provider: "codeforces",
        providerUserKey: entry.user.providerUserKey,
        username: entry.user.username,
        lastProgressSyncedAt: entry.user.lastProgressSyncedAt,
      },
    })),
    updatedAt,
  };
}

export interface RosterServiceShape {
  readonly getRoster: (role: ManagedRosterRole) => Effect.Effect<RosterResponse, RosterError>;
  readonly replaceRoster: (
    role: ManagedRosterRole,
    handles: ReadonlyArray<string>,
  ) => Effect.Effect<RosterResponse, RosterError>;
  readonly syncRoster: (
    role: ManagedRosterRole,
    force?: boolean,
    handles?: ReadonlyArray<string>,
  ) => Effect.Effect<SyncRosterResponse, RosterError>;
}

export class RosterService extends Context.Tag("icpc-trainer/RosterService")<
  RosterService,
  RosterServiceShape
>() {}

export const makeRosterService = Effect.gen(function* () {
  const userRepository = yield* UserRepository;
  const roleRepository = yield* RoleRepository;
  const handleSyncService = yield* HandleSyncService;
  const codeforcesClient = yield* CodeforcesClient;
  const sessionService = yield* SessionService;

  const getRoster = Effect.fn("roster.getRoster")(function* (role: ManagedRosterRole) {
    const entries = yield* userRepository.listByRole(role).pipe(
      Effect.mapError(
        (error) =>
          new RosterError({
            code: "roster_load_failed",
            message: error.message,
          }),
      ),
    );
    return toRosterResponse(role, entries);
  });

  const replaceRoster = Effect.fn("roster.replaceRoster")(function* (
    role: ManagedRosterRole,
    handles: ReadonlyArray<string>,
  ) {
    const previousRoster = yield* getRoster(role);
    const previousHandles = new Set(
      previousRoster.handles.map((handle) => handle.toLowerCase()),
    );
    const normalized = normalizeUniqueHandles(handles);
    if (normalized.invalidHandles.length > 0) {
      return yield* Effect.fail(
        new RosterError({
          code: "invalid_handles",
          message: `Invalid Codeforces handles: ${normalized.invalidHandles.join(", ")}.`,
        }),
      );
    }
    if (normalized.exceedsMaxSize || normalized.normalizedHandles.length > MAX_ROSTER_SIZE) {
      return yield* Effect.fail(
        new RosterError({
          code: "too_many_handles",
          message: `A ${role} roster accepts at most ${MAX_ROSTER_SIZE} unique handles.`,
        }),
      );
    }

    const canonicalUsers: Array<{
      readonly user: { readonly handle: string };
      readonly position: number;
    }> = [];
    for (const [position, handle] of normalized.normalizedHandles.entries()) {
      const resolved = yield* codeforcesClient.getUserInfo(handle).pipe(
        Effect.mapError(
          (error) =>
            new RosterError({
              code: "handle_lookup_failed",
              message: error.message,
            }),
        ),
      );
      if (!resolved) {
        return yield* Effect.fail(
          new RosterError({
            code: "handle_not_found",
            message: `Codeforces handle ${handle} does not exist.`,
          }),
        );
      }

      canonicalUsers.push({
        position,
        user: resolved,
      });
    }

    const upsertedUsers: Array<{ readonly userId: number; readonly handle: string; readonly lastProgressSyncedAt: string | null }> = [];
    for (const item of canonicalUsers) {
      const user = yield* userRepository.upsertCodeforcesUser({
        providerUserKey: item.user.handle.toLowerCase(),
        username: item.user.handle,
      }).pipe(
        Effect.mapError(
          (error) =>
            new RosterError({
              code: "roster_user_upsert_failed",
              message: error.message,
            }),
        ),
      );
      upsertedUsers.push({
        userId: user.id,
        handle: user.username,
        lastProgressSyncedAt: user.lastProgressSyncedAt,
      });
    }

    yield* roleRepository.replaceRoster(
      role,
      upsertedUsers.map((entry, position) => ({
        userId: entry.userId,
        position,
      })),
    ).pipe(
      Effect.mapError(
        (error) =>
          new RosterError({
            code: "roster_replace_failed",
            message: error.message,
          }),
      ),
    );

    if (role === "teammate") {
      const addedHandles = upsertedUsers
        .map((entry) => entry.handle)
        .filter((handle) => !previousHandles.has(handle.toLowerCase()));
      for (const handle of addedHandles) {
        yield* handleSyncService.syncHandle(handle, true).pipe(
          Effect.mapError(
            (error) =>
              new RosterError({
                code: "roster_sync_failed",
                message: error.message,
              }),
          ),
        );
      }
    }

    return yield* getRoster(role);
  });

  const syncRoster = Effect.fn("roster.syncRoster")(function* (
    role: ManagedRosterRole,
    force = false,
    handles?: ReadonlyArray<string>,
  ) {
    const roster = yield* getRoster(role);
    const session = role === "teammate"
      ? yield* sessionService.requireSession().pipe(
          Effect.mapError(
            (error) =>
              new RosterError({
                code: "roster_load_failed",
                message: error.message,
              }),
          ),
        )
      : null;
    const requestedHandles = handles
      ? new Set(handles.map((handle) => handle.trim().toLowerCase()))
      : null;
    const syncCandidates = [
      ...(session
        ? [
            {
              username: session.currentUser.username,
              lastProgressSyncedAt: session.currentUser.lastProgressSyncedAt,
            },
          ]
        : []),
      ...roster.entries.map((entry) => ({
        username: entry.user.username,
        lastProgressSyncedAt: entry.user.lastProgressSyncedAt,
      })),
    ];
    const seenHandles = new Set<string>();
    const handlesToSync = syncCandidates.filter((entry) => {
      const handleKey = entry.username.toLowerCase();
      if (seenHandles.has(handleKey)) {
        return false;
      }
      seenHandles.add(handleKey);

      if (requestedHandles && !requestedHandles.has(handleKey)) {
        return false;
      }

      return force || isStale(entry.lastProgressSyncedAt, HANDLE_STALE_MS);
    });

    for (const entry of handlesToSync) {
      yield* handleSyncService.syncHandle(entry.username, force).pipe(
        Effect.mapError(
          (error) =>
            new RosterError({
              code: "roster_sync_failed",
              message: error.message,
            }),
        ),
      );
    }

    return {
      ok: true,
      roster: yield* getRoster(role),
      syncedHandles: handlesToSync.map((entry) => entry.username),
    } satisfies SyncRosterResponse;
  });

  return RosterService.of({
    getRoster,
    replaceRoster,
    syncRoster,
  });
});

export const RosterServiceLive = Layer.effect(RosterService, makeRosterService);
