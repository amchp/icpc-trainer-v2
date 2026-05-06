import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";

import { ApplicationLive, HttpServerLive, serverProgram } from "./runtime.ts";

export function startServer() {
  NodeRuntime.runMain(
    serverProgram.pipe(Effect.provide(ApplicationLive), Effect.provide(HttpServerLive)),
  );
}

startServer();
