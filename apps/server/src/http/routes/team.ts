import { HttpRouter } from "@effect/platform";
import { Effect } from "effect";

import {
  ReplaceRosterRequest,
  RosterResponse,
  SyncRosterRequest,
  SyncRosterResponse,
} from "../../contracts/roster.ts";
import { RosterError } from "../../errors/roster.ts";
import { decodeJsonBody, errorJson, schemaJson } from "../../lib/http.ts";
import { RosterService } from "../../services/roster.ts";

function rosterStatus(error: RosterError) {
  switch (error.code) {
    case "invalid_handles":
    case "too_many_handles":
    case "handle_not_found":
    case "invalid_request":
      return 400;
    default:
      return 500;
  }
}

export const teamRoutes = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/api/team",
    Effect.gen(function* () {
      const rosterService = yield* RosterService;
      return yield* schemaJson(RosterResponse, yield* rosterService.getRoster("teammate"));
    }).pipe(
      Effect.catchTag("RosterError", (error) =>
        Effect.succeed(errorJson(rosterStatus(error), error._tag, error.message)),
      ),
    ),
  ),
  HttpRouter.put(
    "/api/team",
    Effect.gen(function* () {
      const rosterService = yield* RosterService;
      const payload = yield* decodeJsonBody(
        ReplaceRosterRequest,
        (message) =>
          new RosterError({
            code: "invalid_request",
            message,
          }),
      );
      return yield* schemaJson(
        RosterResponse,
        yield* rosterService.replaceRoster("teammate", payload.handles),
      );
    }).pipe(
      Effect.catchTag("RosterError", (error) =>
        Effect.succeed(errorJson(rosterStatus(error), error._tag, error.message)),
      ),
    ),
  ),
  HttpRouter.post(
    "/api/team/sync",
    Effect.gen(function* () {
      const rosterService = yield* RosterService;
      const payload = yield* decodeJsonBody(
        SyncRosterRequest,
        (message) =>
          new RosterError({
            code: "invalid_request",
            message,
          }),
      );
      return yield* schemaJson(
        SyncRosterResponse,
        yield* rosterService.syncRoster("teammate", payload.force, payload.handles),
      );
    }).pipe(
      Effect.catchTag("RosterError", (error) =>
        Effect.succeed(errorJson(rosterStatus(error), error._tag, error.message)),
      ),
    ),
  ),
);
