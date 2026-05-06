import { HttpRouter } from "@effect/platform";
import { Effect, Schema } from "effect";

import { schemaJson } from "../../lib/http.ts";
import { nowIso } from "../../lib/time.ts";
import { StartupSyncService } from "../../services/startupSync.ts";

const HealthResponse = Schema.Struct({
  ok: Schema.Literal(true),
  startupSyncReady: Schema.Boolean,
  timestamp: Schema.String,
});

export const healthRoutes = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/api/health",
    Effect.gen(function* () {
      const startupSyncService = yield* StartupSyncService;
      return yield* schemaJson(HealthResponse, {
        ok: true as const,
        startupSyncReady: yield* startupSyncService.isReady(),
        timestamp: nowIso(),
      });
    }),
  ),
);
