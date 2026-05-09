import { Context, Effect, Layer } from "effect";
import { and, eq, inArray, sql } from "drizzle-orm";

import { PersistenceError } from "../errors/persistence.ts";
import { nowIso } from "../lib/time.ts";
import { DatabaseService } from "../db/client.ts";
import {
  problems,
  submission,
  userContestState,
  userProblemState,
} from "../db/schema.ts";

export interface SyncedSubmissionInput {
  readonly contestId: number;
  readonly problemId: number;
  readonly externalSubmissionId: string;
  readonly verdict: string;
  readonly submittedAt: string;
}

export interface ProblemStateInput {
  readonly userId: number;
  readonly problemId: number;
  readonly attempted: boolean;
  readonly passed: boolean;
  readonly lastSubmissionAt: string | null;
}

export interface SubmissionRepositoryShape {
  readonly replaceUserSubmissions: (
    userId: number,
    entries: ReadonlyArray<SyncedSubmissionInput>,
  ) => Effect.Effect<void, PersistenceError>;
  readonly upsertUserSubmissions: (
    userId: number,
    entries: ReadonlyArray<SyncedSubmissionInput>,
  ) => Effect.Effect<void, PersistenceError>;
  readonly listExistingExternalSubmissionIds: (
    userId: number,
    externalSubmissionIds: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<string>, PersistenceError>;
  readonly rebuildUserSubmissionState: (
    userId: number,
  ) => Effect.Effect<void, PersistenceError>;
  readonly listProblemStatesForUsers: (
    userIds: ReadonlyArray<number>,
    problemIds: ReadonlyArray<number>,
  ) => Effect.Effect<ReadonlyArray<typeof userProblemState.$inferSelect>, PersistenceError>;
  readonly listAttemptedProblemIdsByContestForUsers: (
    userIds: ReadonlyArray<number>,
    contestIds: ReadonlyArray<number>,
  ) => Effect.Effect<
    ReadonlyArray<{ readonly contestId: number; readonly problemId: number }>,
    PersistenceError
  >;
  readonly upsertProblemStates: (
    entries: ReadonlyArray<ProblemStateInput>,
  ) => Effect.Effect<void, PersistenceError>;
}

export class SubmissionRepository extends Context.Tag("icpc-trainer/SubmissionRepository")<
  SubmissionRepository,
  SubmissionRepositoryShape
>() {}

function isAcceptedVerdict(verdict: string) {
  return verdict === "OK";
}

export const makeSubmissionRepository = Effect.gen(function* () {
  const database = yield* DatabaseService;

  function rebuildUserSubmissionStateInTransaction(
    tx: Parameters<Parameters<typeof database.db.transaction>[0]>[0],
    userId: number,
  ) {
    const timestamp = nowIso();
    tx.delete(userProblemState).where(eq(userProblemState.userId, userId)).run();
    tx.delete(userContestState).where(eq(userContestState.userId, userId)).run();

    const storedSubmissions = tx
      .select({
        row: submission,
        contestId: problems.contestId,
      })
      .from(submission)
      .innerJoin(problems, eq(problems.id, submission.problemId))
      .where(eq(submission.userId, userId))
      .all()
      .sort((left, right) => left.row.submittedAt.localeCompare(right.row.submittedAt));

    if (storedSubmissions.length === 0) {
      return;
    }

    const problemStateByProblemId = new Map<
      number,
      {
        attempted: boolean;
        passed: boolean;
        acceptedSubmissionId: number | null;
        lastSubmissionAt: string | null;
      }
    >();
    const contestStateByContestId = new Map<
      number,
      {
        submissionCount: number;
        acceptedProblemIds: Set<number>;
        lastSubmissionAt: string | null;
      }
    >();

    for (const { row, contestId } of storedSubmissions) {
      const problemState = problemStateByProblemId.get(row.problemId) ?? {
        attempted: false,
        passed: false,
        acceptedSubmissionId: null,
        lastSubmissionAt: null,
      };
      problemState.attempted = true;
      problemState.lastSubmissionAt = row.submittedAt;
      if (isAcceptedVerdict(row.verdict) && !problemState.passed) {
        problemState.passed = true;
        problemState.acceptedSubmissionId = row.id;
      }
      problemStateByProblemId.set(row.problemId, problemState);

      const contestState = contestStateByContestId.get(contestId) ?? {
        submissionCount: 0,
        acceptedProblemIds: new Set<number>(),
        lastSubmissionAt: null,
      };
      contestState.submissionCount += 1;
      contestState.lastSubmissionAt = row.submittedAt;
      if (isAcceptedVerdict(row.verdict)) {
        contestState.acceptedProblemIds.add(row.problemId);
      }
      contestStateByContestId.set(contestId, contestState);
    }

    tx.insert(userProblemState)
      .values(
        [...problemStateByProblemId.entries()].map(([problemId, state]) => ({
          userId,
          problemId,
          attempted: state.attempted,
          passed: state.passed,
          acceptedSubmissionId: state.acceptedSubmissionId,
          lastSubmissionAt: state.lastSubmissionAt,
          updatedAt: timestamp,
        })),
      )
      .run();

    tx.insert(userContestState)
      .values(
        [...contestStateByContestId.entries()].map(([contestId, state]) => ({
          userId,
          contestId,
          submissionCount: state.submissionCount,
          acceptedCount: state.acceptedProblemIds.size,
          qualifiesForGymFinder: state.submissionCount >= 2,
          qualifiesForGymUpsolving: state.submissionCount >= 2,
          qualifiesForContestUpsolving: state.submissionCount >= 1,
          lastSubmissionAt: state.lastSubmissionAt,
          updatedAt: timestamp,
        })),
      )
      .run();
  }

  return SubmissionRepository.of({
    replaceUserSubmissions: (userId, entries) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();

          database.db.transaction((tx) => {
            tx.delete(submission).where(eq(submission.userId, userId)).run();

            if (entries.length > 0) {
              tx.insert(submission)
                .values(
                  entries.map((entry) => ({
                    externalSubmissionId: entry.externalSubmissionId,
                    problemId: entry.problemId,
                    userId,
                    verdict: entry.verdict,
                    submittedAt: entry.submittedAt,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                  })),
                )
                .run();
            }

            rebuildUserSubmissionStateInTransaction(tx, userId);
          });
        },
        catch: (error) =>
          new PersistenceError({
            code: "submission_replace_failed",
            message: error instanceof Error ? error.message : "Failed to replace user submissions.",
          }),
      }),
    upsertUserSubmissions: (userId, entries) =>
      Effect.try({
        try: () => {
          if (entries.length === 0) {
            return;
          }

          const timestamp = nowIso();
          database.db.transaction((tx) => {
            tx.insert(submission)
              .values(
                entries.map((entry) => ({
                  externalSubmissionId: entry.externalSubmissionId,
                  problemId: entry.problemId,
                  userId,
                  verdict: entry.verdict,
                  submittedAt: entry.submittedAt,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })),
              )
              .onConflictDoUpdate({
                target: [submission.userId, submission.externalSubmissionId],
                set: {
                  problemId: sql`excluded.problem_id`,
                  verdict: sql`excluded.verdict`,
                  submittedAt: sql`excluded.submitted_at`,
                  updatedAt: timestamp,
                },
              })
              .run();

            rebuildUserSubmissionStateInTransaction(tx, userId);
          });
        },
        catch: (error) =>
          new PersistenceError({
            code: "submission_upsert_failed",
            message: error instanceof Error ? error.message : "Failed to upsert user submissions.",
          }),
      }),
    listExistingExternalSubmissionIds: (userId, externalSubmissionIds) =>
      Effect.try({
        try: () => {
          if (externalSubmissionIds.length === 0) {
            return [];
          }

          return database.db
            .select({
              externalSubmissionId: submission.externalSubmissionId,
            })
            .from(submission)
            .where(
              and(
                eq(submission.userId, userId),
                inArray(submission.externalSubmissionId, [...externalSubmissionIds]),
              ),
            )
            .all()
            .map((row) => row.externalSubmissionId);
        },
        catch: (error) =>
          new PersistenceError({
            code: "submission_existing_ids_failed",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load existing submission ids.",
          }),
      }),
    rebuildUserSubmissionState: (userId) =>
      Effect.try({
        try: () => {
          database.db.transaction((tx) => {
            rebuildUserSubmissionStateInTransaction(tx, userId);
          });
        },
        catch: (error) =>
          new PersistenceError({
            code: "submission_state_rebuild_failed",
            message:
              error instanceof Error ? error.message : "Failed to rebuild user submission state.",
          }),
      }),
    listProblemStatesForUsers: (userIds, problemIds) =>
      Effect.try({
        try: () => {
          if (userIds.length === 0 || problemIds.length === 0) {
            return [];
          }

          return database.db
            .select()
            .from(userProblemState)
            .where(
              and(
                inArray(userProblemState.userId, [...userIds]),
                inArray(userProblemState.problemId, [...problemIds]),
              ),
            )
            .all();
        },
        catch: (error) =>
          new PersistenceError({
            code: "problem_state_list_failed",
            message: error instanceof Error ? error.message : "Failed to load problem states.",
          }),
      }),
    listAttemptedProblemIdsByContestForUsers: (userIds, contestIds) =>
      Effect.try({
        try: () => {
          if (userIds.length === 0 || contestIds.length === 0) {
            return [];
          }

          const rows = database.db
            .select({
              contestId: problems.contestId,
              problemId: userProblemState.problemId,
            })
            .from(userProblemState)
            .innerJoin(problems, eq(problems.id, userProblemState.problemId))
            .where(
              and(
                inArray(userProblemState.userId, [...userIds]),
                inArray(problems.contestId, [...contestIds]),
                eq(userProblemState.attempted, true),
              ),
            )
            .all();
          const seen = new Set<string>();
          return rows.filter((row) => {
            const key = `${row.contestId}:${row.problemId}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });
        },
        catch: (error) =>
          new PersistenceError({
            code: "attempted_problem_list_failed",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load attempted problems by contest.",
          }),
      }),
    upsertProblemStates: (entries) =>
      Effect.try({
        try: () => {
          if (entries.length === 0) {
            return;
          }

          const timestamp = nowIso();
          database.db.transaction((tx) => {
            for (const entry of entries) {
              tx.insert(userProblemState)
                .values({
                  userId: entry.userId,
                  problemId: entry.problemId,
                  attempted: entry.attempted,
                  passed: entry.passed,
                  acceptedSubmissionId: null,
                  lastSubmissionAt: entry.lastSubmissionAt,
                  updatedAt: timestamp,
                })
                .onConflictDoUpdate({
                  target: [userProblemState.userId, userProblemState.problemId],
                  set: {
                    attempted: sql`${userProblemState.attempted} OR ${entry.attempted}`,
                    passed: sql`${userProblemState.passed} OR ${entry.passed}`,
                    lastSubmissionAt: sql`CASE
                      WHEN ${userProblemState.lastSubmissionAt} IS NULL THEN ${entry.lastSubmissionAt}
                      WHEN ${entry.lastSubmissionAt} IS NULL THEN ${userProblemState.lastSubmissionAt}
                      WHEN ${entry.lastSubmissionAt} > ${userProblemState.lastSubmissionAt} THEN ${entry.lastSubmissionAt}
                      ELSE ${userProblemState.lastSubmissionAt}
                    END`,
                    updatedAt: timestamp,
                  },
                })
                .run();
            }
          });
        },
        catch: (error) =>
          new PersistenceError({
            code: "problem_state_upsert_failed",
            message: error instanceof Error ? error.message : "Failed to update problem states.",
          }),
      }),
  });
});

export const SubmissionRepositoryLive = Layer.effect(
  SubmissionRepository,
  makeSubmissionRepository,
);
