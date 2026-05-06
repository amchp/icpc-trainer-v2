import { HttpRouter } from "@effect/platform";
import { Effect } from "effect";

import { GymFinderResponse } from "../../contracts/gymFinder.ts";
import { GymFinderError } from "../../errors/gymFinder.ts";
import { errorJson, schemaJson } from "../../lib/http.ts";
import { GymFinderService } from "../../services/gymFinder.ts";

function gymFinderStatus(error: GymFinderError) {
  return error.code === "missing_session" ? 401 : 500;
}

export const gymFinderRoutes = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/api/gym-finder",
    Effect.gen(function* () {
      const gymFinderService = yield* GymFinderService;
      return yield* schemaJson(
        GymFinderResponse,
        yield* gymFinderService.buildGymFinderRankings(),
      );
    }).pipe(
      Effect.catchTag("GymFinderError", (error) =>
        Effect.succeed(errorJson(gymFinderStatus(error), error._tag, error.message)),
      ),
    ),
  ),
);
