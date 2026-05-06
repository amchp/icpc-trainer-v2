import { HttpMiddleware, HttpRouter } from "@effect/platform";

import { fallbackRoutes } from "./routes/fallback.ts";
import { friendRoutes } from "./routes/friends.ts";
import { gymFinderRoutes } from "./routes/gymFinder.ts";
import { healthRoutes } from "./routes/health.ts";
import { sessionRoutes } from "./routes/session.ts";
import { teamRoutes } from "./routes/team.ts";
import { upsolvingRoutes } from "./routes/upsolving.ts";

export function makeHttpApp() {
  return HttpRouter.concatAll(
    healthRoutes,
    sessionRoutes,
    friendRoutes,
    teamRoutes,
    gymFinderRoutes,
    upsolvingRoutes,
    fallbackRoutes,
  ).pipe(
    HttpMiddleware.cors({
      allowedMethods: ["GET", "POST", "PUT", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    }),
  );
}
