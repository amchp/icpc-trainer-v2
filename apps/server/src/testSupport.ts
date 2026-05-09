import { Layer } from "effect";

import { makeDatabaseLayer } from "./db/client.ts";
import { CacheRepositoryLive } from "./repos/cache.ts";
import { ContestRepositoryLive } from "./repos/contests.ts";
import { RoleRepositoryLive } from "./repos/roles.ts";
import { SessionRepositoryLive } from "./repos/session.ts";
import { SubmissionRepositoryLive } from "./repos/submissions.ts";
import { UserRepositoryLive } from "./repos/users.ts";
import type { CodeforcesClientShape } from "./services/codeforcesClient.ts";
import { CodeforcesClient } from "./services/codeforcesClient.ts";
import { CatalogSyncServiceLive } from "./services/catalogSync.ts";
import { GymFinderServiceLive } from "./services/gymFinder.ts";
import { HandleSyncServiceLive } from "./services/handleSync.ts";
import { RosterServiceLive } from "./services/roster.ts";
import { SessionServiceLive } from "./services/session.ts";
import { StartupSyncServiceLive } from "./services/startupSync.ts";
import { UpsolvingEventServiceLive } from "./services/upsolvingEvents.ts";
import { UpsolvingServiceLive } from "./services/upsolving.ts";

export function makeTestApplicationLayer(fakeCodeforcesClient: CodeforcesClientShape) {
  const DatabaseTestLive = makeDatabaseLayer({
    databaseUrl: ":memory:",
  });
  const RepositoryLive = Layer.mergeAll(
    SessionRepositoryLive,
    UserRepositoryLive,
    ContestRepositoryLive,
    SubmissionRepositoryLive,
    RoleRepositoryLive,
    CacheRepositoryLive,
  ).pipe(Layer.provide(DatabaseTestLive));

  const BaseLive = Layer.mergeAll(
    RepositoryLive,
    Layer.succeed(CodeforcesClient, CodeforcesClient.of(fakeCodeforcesClient)),
    UpsolvingEventServiceLive,
  );
  const CatalogSyncFullLive = CatalogSyncServiceLive.pipe(Layer.provide(BaseLive));
  const HandleSyncFullLive = HandleSyncServiceLive.pipe(
    Layer.provide(Layer.mergeAll(BaseLive, CatalogSyncFullLive)),
  );
  const SessionServiceFullLive = SessionServiceLive.pipe(
    Layer.provide(Layer.mergeAll(BaseLive, CatalogSyncFullLive, HandleSyncFullLive)),
  );
  const RosterServiceFullLive = RosterServiceLive.pipe(
    Layer.provide(Layer.mergeAll(BaseLive, HandleSyncFullLive, SessionServiceFullLive)),
  );
  const GymFinderServiceFullLive = GymFinderServiceLive.pipe(
    Layer.provide(Layer.mergeAll(RepositoryLive, SessionServiceFullLive)),
  );
  const UpsolvingServiceFullLive = UpsolvingServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        BaseLive,
        CatalogSyncFullLive,
        HandleSyncFullLive,
        SessionServiceFullLive,
      ),
    ),
  );
  const StartupSyncServiceFullLive = StartupSyncServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        BaseLive,
        CatalogSyncFullLive,
        HandleSyncFullLive,
        SessionServiceFullLive,
      ),
    ),
  );

  return Layer.mergeAll(
    BaseLive,
    CatalogSyncFullLive,
    HandleSyncFullLive,
    SessionServiceFullLive,
    RosterServiceFullLive,
    GymFinderServiceFullLive,
    UpsolvingServiceFullLive,
    StartupSyncServiceFullLive,
  );
}
