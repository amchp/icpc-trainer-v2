import { Schema } from "effect";

import { Handle, ManagedRosterRole, Timestamp, UserSummary } from "./common.ts";

export const ReplaceRosterRequest = Schema.Struct({
  handles: Schema.Array(Handle).pipe(Schema.maxItems(10)),
});
export type ReplaceRosterRequest = typeof ReplaceRosterRequest.Type;

export const SyncRosterRequest = Schema.Struct({
  force: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  handles: Schema.optional(Schema.Array(Handle).pipe(Schema.maxItems(10))),
});
export type SyncRosterRequest = typeof SyncRosterRequest.Type;

export const RosterEntry = Schema.Struct({
  role: ManagedRosterRole,
  position: Schema.Int,
  user: UserSummary,
});
export type RosterEntry = typeof RosterEntry.Type;

export const RosterResponse = Schema.Struct({
  role: ManagedRosterRole,
  handles: Schema.Array(Handle),
  entries: Schema.Array(RosterEntry),
  updatedAt: Schema.NullOr(Timestamp),
});
export type RosterResponse = typeof RosterResponse.Type;

export const SyncRosterResponse = Schema.Struct({
  ok: Schema.Literal(true),
  roster: RosterResponse,
  syncedHandles: Schema.Array(Handle),
});
export type SyncRosterResponse = typeof SyncRosterResponse.Type;
