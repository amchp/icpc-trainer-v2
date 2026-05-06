import { HttpClient, HttpServer } from "@effect/platform";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { makeHttpApp } from "./app.ts";
import type { CodeforcesClientShape } from "../services/codeforcesClient.ts";
import { makeTestApplicationLayer } from "../testSupport.ts";

const fakeCodeforcesClient: CodeforcesClientShape = {
  getUserInfo: () => Effect.succeed(null),
  validateSignedCredentials: () => Effect.void,
  getContestCatalog: () => Effect.succeed(new Map()),
  getGymContestCatalog: () => Effect.succeed(new Map()),
  getRegularContestCatalog: () => Effect.succeed(new Map()),
  getProblemsetProblems: () =>
    Effect.succeed({
      problems: [],
      problemStatistics: [],
    }),
  getUserStatusPage: () => Effect.succeed([]),
  getContestStandingsPage: () =>
    Effect.succeed({
      contest: {
        id: 1,
        name: "Contest",
        phase: "FINISHED",
        frozen: false,
        durationSeconds: 1,
      },
      problems: [],
      rows: [],
    }),
  getSignedContestStandingsPage: () =>
    Effect.succeed({
      contest: {
        id: 1,
        name: "Contest",
        phase: "FINISHED",
        frozen: false,
        durationSeconds: 1,
      },
      problems: [],
      rows: [],
    }),
};

describe("http app", () => {
  it("serves health through the effect runtime", async () => {
    const TestLive = Layer.mergeAll(
      NodeHttpServer.layerTest,
      makeTestApplicationLayer(fakeCodeforcesClient),
    );

    const response = await Effect.scoped(
      Effect.gen(function* () {
        yield* HttpServer.serveEffect(makeHttpApp());
        return yield* HttpClient.get("/api/health");
      }),
    ).pipe(Effect.provide(TestLive), Effect.runPromise);

    expect(response.status).toBe(200);

    const body = (await Effect.runPromise(response.json)) as {
      ok: boolean;
      startupSyncReady: boolean;
      timestamp: string;
    };

    expect(body.ok).toBe(true);
    expect(body.startupSyncReady).toBe(false);
    expect(typeof body.timestamp).toBe("string");
  });
});
