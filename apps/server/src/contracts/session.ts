import { Schema } from "effect";

import { Credentials, NonEmptyHandle, Timestamp, UserSummary } from "./common.ts";

export const LoginRequest = Schema.Struct({
  handle: NonEmptyHandle,
  apiKey: Credentials.fields.apiKey,
  apiSecret: Credentials.fields.apiSecret,
});
export type LoginRequest = typeof LoginRequest.Type;

export const SessionSnapshot = Schema.Struct({
  currentUser: UserSummary,
  currentHandle: Schema.String,
  authenticatedAt: Timestamp,
  lastValidatedAt: Timestamp,
});
export type SessionSnapshot = typeof SessionSnapshot.Type;

export const SessionResponse = Schema.Struct({
  session: Schema.NullOr(SessionSnapshot),
  startupSyncReady: Schema.Boolean,
});
export type SessionResponse = typeof SessionResponse.Type;

export const LogoutResponse = Schema.Struct({
  ok: Schema.Literal(true),
  session: Schema.NullOr(SessionSnapshot),
});
export type LogoutResponse = typeof LogoutResponse.Type;
