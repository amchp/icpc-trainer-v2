import { createServer } from "node:http";

import { HttpServer } from "@effect/platform";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Effect, Layer } from "effect";

import { DatabaseLive } from "./db/client.ts";
import { makeHttpApp } from "./http/app.ts";
import { CacheRepositoryLive } from "./repos/cache.ts";
import { ContestRepositoryLive } from "./repos/contests.ts";
import { RoleRepositoryLive } from "./repos/roles.ts";
import { SessionRepositoryLive } from "./repos/session.ts";
import { SubmissionRepositoryLive } from "./repos/submissions.ts";
import { UserRepositoryLive } from "./repos/users.ts";
import { CatalogSyncServiceLive } from "./services/catalogSync.ts";
import { CodeforcesClientLive } from "./services/codeforcesClient.ts";
import { GymFinderServiceLive } from "./services/gymFinder.ts";
import { HandleSyncServiceLive } from "./services/handleSync.ts";
import { RosterServiceLive } from "./services/roster.ts";
import { SessionServiceLive } from "./services/session.ts";
import { StartupSyncService, StartupSyncServiceLive } from "./services/startupSync.ts";
import { UpsolvingEventServiceLive } from "./services/upsolvingEvents.ts";
import { UpsolvingServiceLive } from "./services/upsolving.ts";

const port = Number(process.env.PORT ?? 4000);

export const ClockLive = Layer.empty;
export const LoggerLive = Layer.empty;
export const HttpServerLive = NodeHttpServer.layer(createServer, {
  host: "127.0.0.1",
  port,
});

const RepositoryLive = Layer.mergeAll(
  SessionRepositoryLive,
  UserRepositoryLive,
  ContestRepositoryLive,
  SubmissionRepositoryLive,
  RoleRepositoryLive,
  CacheRepositoryLive,
);

const RepositoryWithDbLive = RepositoryLive.pipe(Layer.provide(DatabaseLive));
const BaseLive = Layer.mergeAll(
  RepositoryWithDbLive,
  CodeforcesClientLive,
  UpsolvingEventServiceLive,
);
const CatalogSyncFullLive = CatalogSyncServiceLive.pipe(Layer.provide(BaseLive));
const HandleSyncFullLive = HandleSyncServiceLive.pipe(
  Layer.provide(Layer.mergeAll(BaseLive, CatalogSyncFullLive)),
);
const SessionServiceFullLive = SessionServiceLive.pipe(
  Layer.provide(BaseLive),
);
const RosterServiceFullLive = RosterServiceLive.pipe(
  Layer.provide(Layer.mergeAll(BaseLive, HandleSyncFullLive)),
);
const GymFinderServiceFullLive = GymFinderServiceLive.pipe(
  Layer.provide(Layer.mergeAll(RepositoryWithDbLive, SessionServiceFullLive)),
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

export const ApplicationLive = Layer.mergeAll(
  ClockLive,
  LoggerLive,
  BaseLive,
  CatalogSyncFullLive,
  HandleSyncFullLive,
  SessionServiceFullLive,
  RosterServiceFullLive,
  GymFinderServiceFullLive,
  UpsolvingServiceFullLive,
  StartupSyncServiceFullLive,
);

export const HttpApplicationLive = HttpServer.serve(makeHttpApp());

export const serverProgram = Effect.scoped(
  Effect.gen(function* () {
    yield* Layer.launch(HttpApplicationLive);
    const startupSyncService = yield* StartupSyncService;
    yield* HttpServer.addressFormattedWith((address) =>
      Effect.sync(() => {
        console.log(`API listening on ${address}`);
      }),
    );
    yield* startupSyncService.runStartupSync().pipe(Effect.forkDaemon);
    return yield* Effect.never;
  }),
);
