import { Schema } from "effect";

import { ContestSummary, Handle } from "./common.ts";

export const GymFinderRanking = Schema.Struct({
  contest: ContestSummary,
  friendCount: Schema.Int,
  coverage: Schema.Number,
  handles: Schema.Array(Handle),
});
export type GymFinderRanking = typeof GymFinderRanking.Type;

export const GymFinderResponse = Schema.Struct({
  rankings: Schema.Array(GymFinderRanking),
});
export type GymFinderResponse = typeof GymFinderResponse.Type;
