import { Context, Effect, Layer, Ref } from "effect";

import { HANDLE_STALE_MS } from "../lib/constants.ts";
import { isStale } from "../lib/time.ts";
import { SyncError } from "../errors/sync.ts";
import { UserRepository } from "../repos/users.ts";
import { CatalogSyncService } from "./catalogSync.ts";
import { HandleSyncService } from "./handleSync.ts";
import { SessionService } from "./session.ts";
import { UpsolvingEventService } from "./upsolvingEvents.ts";

export interface StartupSyncServiceShape {
  readonly isReady: () => Effect.Effect<boolean>;
  readonly runStartupSync: () => Effect.Effect<void, SyncError>;
}

export class StartupSyncService extends Context.Tag("icpc-trainer/StartupSyncService")<
  StartupSyncService,
  StartupSyncServiceShape
>() {}

export const makeStartupSyncService = Effect.gen(function* () {
  const ready = yield* Ref.make(false);
  const sessionService = yield* SessionService;
  const catalogSyncService = yield* CatalogSyncService;
  const userRepository = yield* UserRepository;
  const handleSyncService = yield* HandleSyncService;
  const upsolvingEvents = yield* UpsolvingEventService;

  const runStartupSync = Effect.fn("startupSync.runStartupSync")(function* () {
    yield* Ref.set(ready, false);
    yield* upsolvingEvents.publish({
      type: "startup.progress",
      message: "Restoring Codeforces session",
    });

    const session = yield* sessionService.getSession().pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: error.code,
            message: error.message,
          }),
      ),
    );
    if (!session) {
      return;
    }

    yield* upsolvingEvents.publish({
      type: "startup.progress",
      message: "Grabbing contest catalogs and problemset",
    });
    yield* catalogSyncService.syncCatalogsIfStale(false).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: error.code,
            message: error.message,
          }),
      ),
    );

    const roleUsers = yield* userRepository.listByRoles(["primary", "teammate"]).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "startup_roles_load_failed",
            message: error.message,
          }),
      ),
    );

    const handles = new Map<string, string>();
    handles.set(session.currentHandle.toLowerCase(), session.currentHandle);
    for (const entry of roleUsers) {
      handles.set(entry.user.username.toLowerCase(), entry.user.username);
    }

    for (const handle of handles.values()) {
      yield* upsolvingEvents.publish({
        type: "startup.progress",
        message: `Syncing user data for ${handle}`,
      });
      const user = yield* userRepository.findByHandle(handle).pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "startup_user_lookup_failed",
              message: error.message,
            }),
        ),
      );
      if (!user || isStale(user.lastProgressSyncedAt, HANDLE_STALE_MS)) {
        yield* handleSyncService.syncHandle(handle, false).pipe(
          Effect.mapError(
            (error) =>
              new SyncError({
                code: "startup_handle_sync_failed",
                message: error.message,
              }),
          ),
        );
      }
    }

    yield* Ref.set(ready, true);
    yield* upsolvingEvents.publish({
      type: "startup.completed",
      message: "Training data ready",
    });
  });

  return StartupSyncService.of({
    isReady: () => Ref.get(ready),
    runStartupSync,
  });
});

export const StartupSyncServiceLive = Layer.effect(
  StartupSyncService,
  makeStartupSyncService,
);
