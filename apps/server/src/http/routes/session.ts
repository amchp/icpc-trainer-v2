import { HttpRouter } from "@effect/platform";
import { Effect } from "effect";

import { LoginRequest, LogoutResponse, SessionResponse } from "../../contracts/session.ts";
import { AuthError } from "../../errors/auth.ts";
import { SessionError } from "../../errors/session.ts";
import { decodeJsonBody, errorJson, schemaJson } from "../../lib/http.ts";
import { SessionService } from "../../services/session.ts";
import { StartupSyncService } from "../../services/startupSync.ts";

function sessionStatus(error: SessionError | AuthError) {
  if (error._tag === "AuthError") {
    return error.code === "invalid_signed_credentials" ? 401 : 400;
  }

  return error.code === "missing_session" ? 401 : 500;
}

export const sessionRoutes = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/api/session",
    Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const startupSyncService = yield* StartupSyncService;
      return yield* schemaJson(SessionResponse, {
        session: yield* sessionService.getSession(),
        startupSyncReady: yield* startupSyncService.isReady(),
      });
    }).pipe(
      Effect.catchTag("SessionError", (error) =>
        Effect.succeed(errorJson(sessionStatus(error), error._tag, error.message)),
      ),
    ),
  ),
  HttpRouter.post(
    "/api/session/login",
    Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const startupSyncService = yield* StartupSyncService;
      const payload = yield* decodeJsonBody(
        LoginRequest,
        (message) =>
          new AuthError({
            code: "invalid_request",
            message,
          }),
      );
      const session = yield* sessionService.login(payload);
      yield* startupSyncService.runStartupSync();
      return yield* schemaJson(SessionResponse, {
        session,
        startupSyncReady: yield* startupSyncService.isReady(),
      });
    }).pipe(
      Effect.catchTags({
        AuthError: (error) =>
          Effect.succeed(errorJson(sessionStatus(error), error._tag, error.message)),
        SessionError: (error) =>
          Effect.succeed(errorJson(sessionStatus(error), error._tag, error.message)),
      }),
    ),
  ),
  HttpRouter.post(
    "/api/session/logout",
    Effect.gen(function* () {
      const sessionService = yield* SessionService;
      yield* sessionService.logout();
      return yield* schemaJson(LogoutResponse, {
        ok: true,
        session: null,
      });
    }).pipe(
      Effect.catchTag("SessionError", (error) =>
        Effect.succeed(errorJson(sessionStatus(error), error._tag, error.message)),
      ),
    ),
  ),
);
