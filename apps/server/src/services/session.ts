import { Context, Effect, Layer } from "effect";

import type { SessionSnapshot } from "../contracts/session.ts";
import { AuthError } from "../errors/auth.ts";
import { SessionError } from "../errors/session.ts";
import { RoleRepository } from "../repos/roles.ts";
import { SessionRepository } from "../repos/session.ts";
import { UserRepository } from "../repos/users.ts";
import { normalizeHandleKey } from "../lib/handles.ts";
import { nowIso } from "../lib/time.ts";
import { CodeforcesClient } from "./codeforcesClient.ts";

export interface LoginInput {
  readonly handle: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

export interface CodeforcesCredentials {
  readonly apiKey: string;
  readonly apiSecret: string;
}

export interface SessionServiceShape {
  readonly getSession: () => Effect.Effect<SessionSnapshot | null, SessionError>;
  readonly requireSession: () => Effect.Effect<SessionSnapshot, SessionError>;
  readonly requireCodeforcesCredentials: () => Effect.Effect<CodeforcesCredentials, SessionError>;
  readonly login: (input: LoginInput) => Effect.Effect<SessionSnapshot, SessionError | AuthError>;
  readonly logout: () => Effect.Effect<void, SessionError>;
}

export class SessionService extends Context.Tag("icpc-trainer/SessionService")<
  SessionService,
  SessionServiceShape
>() {}

function toSessionSnapshot(
  user: typeof import("../db/schema.ts").users.$inferSelect,
  session: NonNullable<typeof import("../db/schema.ts").appSession.$inferSelect>,
): SessionSnapshot {
  return {
    currentUser: {
      id: user.id,
      provider: "codeforces",
      providerUserKey: user.providerUserKey,
      username: user.username,
      lastProgressSyncedAt: user.lastProgressSyncedAt,
    },
    currentHandle: session.currentHandle ?? user.username,
    authenticatedAt: session.authenticatedAt ?? session.createdAt,
    lastValidatedAt: session.lastValidatedAt ?? session.updatedAt,
  };
}

export const makeSessionService = Effect.gen(function* () {
  const sessionRepository = yield* SessionRepository;
  const userRepository = yield* UserRepository;
  const roleRepository = yield* RoleRepository;
  const codeforcesClient = yield* CodeforcesClient;

  const getSession = Effect.fn("session.getSession")(function* () {
    const session = yield* sessionRepository.get().pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "session_load_failed",
            message: error.message,
          }),
      ),
    );
    if (!session?.currentUserId) {
      return null;
    }

    const user = yield* userRepository.findById(session.currentUserId).pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "session_user_load_failed",
            message: error.message,
          }),
      ),
    );
    if (!user) {
      return null;
    }

    return toSessionSnapshot(user, session);
  });

  const requireSession = Effect.fn("session.requireSession")(function* () {
    const session = yield* getSession();
    if (!session) {
      return yield* Effect.fail(
        new SessionError({
          code: "missing_session",
          message: "No active session.",
        }),
      );
    }
    return session;
  });

  const requireCodeforcesCredentials = Effect.fn("session.requireCodeforcesCredentials")(function* () {
    yield* requireSession();
    const session = yield* sessionRepository.get().pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "session_load_failed",
            message: error.message,
          }),
      ),
    );
    if (!session?.apiKey || !session.apiSecret) {
      return yield* Effect.fail(
        new SessionError({
          code: "missing_credentials",
          message: "No Codeforces API credentials are stored for the active session.",
        }),
      );
    }
    return {
      apiKey: session.apiKey,
      apiSecret: session.apiSecret,
    };
  });

  const login = Effect.fn("session.login")(function* (input: LoginInput) {
    const trimmedHandle = input.handle.trim();
    const apiKey = input.apiKey.trim();
    const apiSecret = input.apiSecret.trim();

    if (!trimmedHandle || !apiKey || !apiSecret) {
      return yield* Effect.fail(
        new AuthError({
          code: "missing_credentials",
          message: "Handle, apiKey, and apiSecret are required.",
        }),
      );
    }

    const resolvedUser = yield* codeforcesClient.getUserInfo(trimmedHandle).pipe(
      Effect.mapError(
        (error) =>
          new AuthError({
            code: "handle_lookup_failed",
            message: error.message,
          }),
      ),
    );
    if (!resolvedUser) {
      return yield* Effect.fail(
        new AuthError({
          code: "handle_not_found",
          message: `Codeforces handle ${trimmedHandle} does not exist.`,
        }),
      );
    }

    yield* codeforcesClient.validateSignedCredentials(apiKey, apiSecret).pipe(
      Effect.mapError(
        (error) =>
          new AuthError({
            code: "invalid_signed_credentials",
            message: error.message,
          }),
      ),
    );

    const canonicalHandle = resolvedUser.handle;
    const timestamp = nowIso();
    const user = yield* userRepository.upsertCodeforcesUser({
      providerUserKey: normalizeHandleKey(canonicalHandle),
      username: canonicalHandle,
      lastProgressSyncedAt: null,
    }).pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "user_upsert_failed",
            message: error.message,
          }),
      ),
    );

    yield* roleRepository.assign({
      userId: user.id,
      role: "primary",
      position: null,
    }).pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "primary_role_assign_failed",
            message: error.message,
          }),
      ),
    );

    yield* sessionRepository.save({
      currentUserId: user.id,
      currentHandle: canonicalHandle,
      apiKey,
      apiSecret,
      authenticatedAt: timestamp,
      lastValidatedAt: timestamp,
    }).pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "session_save_failed",
            message: error.message,
          }),
      ),
    );

    const savedSession = yield* getSession();
    if (!savedSession) {
      return yield* Effect.fail(
        new SessionError({
          code: "session_missing_after_login",
          message: "Session was not available after login.",
        }),
      );
    }
    return savedSession;
  });

  const logout = Effect.fn("session.logout")(function* () {
    const session = yield* sessionRepository.get().pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "session_load_failed",
            message: error.message,
          }),
      ),
    );

    yield* sessionRepository.clear().pipe(
      Effect.mapError(
        (error) =>
          new SessionError({
            code: "session_clear_failed",
            message: error.message,
          }),
      ),
    );

    if (session?.currentUserId) {
      yield* roleRepository.remove(session.currentUserId, "primary").pipe(
        Effect.mapError(
          (error) =>
            new SessionError({
              code: "primary_role_remove_failed",
              message: error.message,
            }),
        ),
      );
    }
  });

  return SessionService.of({
    getSession,
    requireSession,
    requireCodeforcesCredentials,
    login,
    logout,
  });
});

export const SessionServiceLive = Layer.effect(SessionService, makeSessionService);
