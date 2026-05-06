import { Schema } from "effect";

import { ContestSummary, TeamAnnotation } from "./common.ts";

export const UpsolvingProblem = Schema.Struct({
  id: Schema.Int,
  contestId: Schema.Int,
  providerProblemKey: Schema.String,
  title: Schema.String,
  url: Schema.String,
  position: Schema.NullOr(Schema.Int),
  points: Schema.NullOr(Schema.Number),
  rating: Schema.NullOr(Schema.Int),
  tags: Schema.Array(Schema.String),
  solverCount: Schema.NullOr(Schema.Int),
  attemptCount: Schema.NullOr(Schema.Int),
  submissionCount: Schema.NullOr(Schema.Int),
  solveRate: Schema.NullOr(Schema.Number),
  attempted: Schema.Boolean,
  passed: Schema.Boolean,
  team: TeamAnnotation,
});
export type UpsolvingProblem = typeof UpsolvingProblem.Type;

export const UpsolvingContest = Schema.Struct({
  contest: ContestSummary,
  submissionCount: Schema.Int,
  acceptedCount: Schema.Int,
  problems: Schema.Array(UpsolvingProblem),
});
export type UpsolvingContest = typeof UpsolvingContest.Type;

export const UpsolvingProgress = Schema.Struct({
  totalContestCount: Schema.Int,
  readyContestCount: Schema.Int,
  pendingContestCount: Schema.Int,
  totalGymCount: Schema.Int,
  readyGymCount: Schema.Int,
  pendingGymCount: Schema.Int,
  activeGymTitle: Schema.NullOr(Schema.String),
});
export type UpsolvingProgress = typeof UpsolvingProgress.Type;

export const UpsolvingOverviewResponse = Schema.Struct({
  gyms: Schema.Array(UpsolvingContest),
  contests: Schema.Array(UpsolvingContest),
  progress: UpsolvingProgress,
});
export type UpsolvingOverviewResponse = typeof UpsolvingOverviewResponse.Type;

export const UpsolvingContestDetailResponse = Schema.Struct({
  entry: UpsolvingContest,
});
export type UpsolvingContestDetailResponse = typeof UpsolvingContestDetailResponse.Type;

export const SyncUpsolvingResponse = Schema.Struct({
  ok: Schema.Literal(true),
  syncedContestIds: Schema.Array(Schema.Int),
});
export type SyncUpsolvingResponse = typeof SyncUpsolvingResponse.Type;

export const CompleteUpsolvingProblemResponse = Schema.Struct({
  ok: Schema.Literal(true),
  problemId: Schema.Int,
});
export type CompleteUpsolvingProblemResponse =
  typeof CompleteUpsolvingProblemResponse.Type;

export const CompleteUpsolvingProblemsResponse = Schema.Struct({
  ok: Schema.Literal(true),
  problemIds: Schema.Array(Schema.Int),
});
export type CompleteUpsolvingProblemsResponse =
  typeof CompleteUpsolvingProblemsResponse.Type;
