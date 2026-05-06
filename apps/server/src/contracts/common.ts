import { Schema } from "effect";

import {
  CONTEST_PROVIDERS,
  MANAGED_ROSTER_ROLES,
  PARTICIPANT_ROLES,
  USER_PROVIDER,
} from "../lib/constants.ts";
import { CODEFORCES_HANDLE_PATTERN } from "../lib/handles.ts";

export const Timestamp = Schema.String;
export type Timestamp = typeof Timestamp.Type;

export const UserProvider = Schema.Literal(USER_PROVIDER);
export type UserProvider = typeof UserProvider.Type;

export const ContestProvider = Schema.Literal(...CONTEST_PROVIDERS);
export type ContestProvider = typeof ContestProvider.Type;

export const ParticipantRole = Schema.Literal(...PARTICIPANT_ROLES);
export type ParticipantRole = typeof ParticipantRole.Type;

export const ManagedRosterRole = Schema.Literal(...MANAGED_ROSTER_ROLES);
export type ManagedRosterRole = typeof ManagedRosterRole.Type;

export const Handle = Schema.String.pipe(Schema.pattern(CODEFORCES_HANDLE_PATTERN));
export type Handle = typeof Handle.Type;

export const NonEmptyHandle = Schema.NonEmptyString.pipe(
  Schema.pattern(CODEFORCES_HANDLE_PATTERN),
);
export type NonEmptyHandle = typeof NonEmptyHandle.Type;

export const Credentials = Schema.Struct({
  apiKey: Schema.NonEmptyString,
  apiSecret: Schema.NonEmptyString,
});
export type Credentials = typeof Credentials.Type;

export const UserSummary = Schema.Struct({
  id: Schema.Int,
  provider: UserProvider,
  providerUserKey: Schema.String,
  username: Schema.String,
  lastProgressSyncedAt: Schema.NullOr(Timestamp),
});
export type UserSummary = typeof UserSummary.Type;

export const ContestSummary = Schema.Struct({
  id: Schema.Int,
  provider: ContestProvider,
  providerContestKey: Schema.String,
  title: Schema.String,
  url: Schema.String,
  startsAt: Schema.NullOr(Timestamp),
  participantCount: Schema.NullOr(Schema.Int),
});
export type ContestSummary = typeof ContestSummary.Type;

export const TeamAnnotation = Schema.Struct({
  attemptedByTeam: Schema.Boolean,
  solvedByTeam: Schema.Boolean,
});
export type TeamAnnotation = typeof TeamAnnotation.Type;

export const ApiErrorPayload = Schema.Struct({
  error: Schema.Struct({
    tag: Schema.String,
    message: Schema.String,
  }),
});
export type ApiErrorPayload = typeof ApiErrorPayload.Type;
