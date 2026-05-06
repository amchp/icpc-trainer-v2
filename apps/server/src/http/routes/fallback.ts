import { HttpRouter } from "@effect/platform";
import { Effect } from "effect";

import { errorJson } from "../../lib/http.ts";

export const fallbackRoutes = HttpRouter.empty.pipe(
  HttpRouter.all("*", Effect.succeed(errorJson(404, "RouteNotFound", "Not found."))),
);
