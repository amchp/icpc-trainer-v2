import { Context, Effect, Layer } from "effect";
import { and, asc, eq, inArray, or } from "drizzle-orm";

import { PersistenceError } from "../errors/persistence.ts";
import { nowIso } from "../lib/time.ts";
import { DatabaseService } from "../db/client.ts";
import {
  contests,
  problems,
  userContestState,
} from "../db/schema.ts";

export interface UpsertContestInput {
  readonly provider: string;
  readonly providerContestKey: string;
  readonly title: string;
  readonly url: string;
  readonly startsAt?: string | null;
  readonly participantCount?: number | null;
  readonly syncState?: string;
  readonly syncError?: string | null;
  readonly lastSyncAttemptedAt?: string | null;
  readonly syncedAt?: string | null;
}

export interface UpsertProblemInput {
  readonly contestId: number;
  readonly providerProblemKey: string;
  readonly title: string;
  readonly url: string;
  readonly position?: number | null;
  readonly points?: number | null;
  readonly rating?: number | null;
  readonly tags?: readonly string[];
  readonly solverCount?: number | null;
  readonly attemptCount?: number | null;
  readonly submissionCount?: number | null;
  readonly solveRate?: number | null;
}

export interface ContestRepositoryShape {
  readonly upsertContest: (
    input: UpsertContestInput,
  ) => Effect.Effect<typeof contests.$inferSelect, PersistenceError>;
  readonly upsertProblems: (
    entries: ReadonlyArray<UpsertProblemInput>,
  ) => Effect.Effect<ReadonlyArray<typeof problems.$inferSelect>, PersistenceError>;
  readonly getContestById: (
    contestId: number,
  ) => Effect.Effect<typeof contests.$inferSelect | null, PersistenceError>;
  readonly getContestByProviderKey: (
    provider: string,
    providerContestKey: string,
  ) => Effect.Effect<typeof contests.$inferSelect | null, PersistenceError>;
  readonly getContestsByIds: (
    contestIds: ReadonlyArray<number>,
  ) => Effect.Effect<ReadonlyArray<typeof contests.$inferSelect>, PersistenceError>;
  readonly listProblemsByContestIds: (
    contestIds: ReadonlyArray<number>,
  ) => Effect.Effect<ReadonlyArray<typeof problems.$inferSelect>, PersistenceError>;
  readonly getProblemById: (
    problemId: number,
  ) => Effect.Effect<typeof problems.$inferSelect | null, PersistenceError>;
  readonly listProblemsByIds: (
    problemIds: ReadonlyArray<number>,
  ) => Effect.Effect<ReadonlyArray<typeof problems.$inferSelect>, PersistenceError>;
  readonly listUpsolvingContestsForUser: (
    userId: number,
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly contest: typeof contests.$inferSelect;
      readonly state: typeof userContestState.$inferSelect;
    }>,
    PersistenceError
  >;
  readonly listQualifiedGymContestsForUser: (
    userId: number,
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly contest: typeof contests.$inferSelect;
      readonly state: typeof userContestState.$inferSelect;
    }>,
    PersistenceError
  >;
}

export class ContestRepository extends Context.Tag("icpc-trainer/ContestRepository")<
  ContestRepository,
  ContestRepositoryShape
>() {}

export const makeContestRepository = Effect.gen(function* () {
  const database = yield* DatabaseService;

  return ContestRepository.of({
    upsertContest: (input) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          database.db
            .insert(contests)
            .values({
              provider: input.provider,
              providerContestKey: input.providerContestKey,
              title: input.title,
              url: input.url,
              startsAt: input.startsAt ?? null,
              participantCount: input.participantCount ?? null,
              syncState: input.syncState ?? "pending",
              syncError: input.syncError ?? null,
              lastSyncAttemptedAt: input.lastSyncAttemptedAt ?? null,
              syncedAt: input.syncedAt ?? null,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            .onConflictDoUpdate({
              target: [contests.provider, contests.providerContestKey],
              set: {
                title: input.title,
                url: input.url,
                startsAt: input.startsAt ?? null,
                participantCount: input.participantCount ?? null,
                syncState: input.syncState ?? "pending",
                syncError: input.syncError ?? null,
                lastSyncAttemptedAt: input.lastSyncAttemptedAt ?? null,
                syncedAt: input.syncedAt ?? null,
                updatedAt: timestamp,
              },
            })
            .run();

          const contest = database.db
            .select()
            .from(contests)
            .where(
              and(
                eq(contests.provider, input.provider),
                eq(contests.providerContestKey, input.providerContestKey),
              ),
            )
            .get();

          if (!contest) {
            throw new Error(`Contest ${input.provider}:${input.providerContestKey} missing after upsert.`);
          }

          return contest;
        },
        catch: (error) =>
          new PersistenceError({
            code: "contest_upsert_failed",
            message: error instanceof Error ? error.message : "Failed to upsert contest.",
          }),
      }),
    upsertProblems: (entries) =>
      Effect.try({
        try: () => {
          const timestamp = nowIso();
          for (const entry of entries) {
            database.db
              .insert(problems)
              .values({
                contestId: entry.contestId,
                providerProblemKey: entry.providerProblemKey,
                title: entry.title,
                url: entry.url,
                position: entry.position ?? null,
                points: entry.points ?? null,
                rating: entry.rating ?? null,
                tags: entry.tags ?? [],
                solverCount: entry.solverCount ?? null,
                attemptCount: entry.attemptCount ?? null,
                submissionCount: entry.submissionCount ?? null,
                solveRate: entry.solveRate ?? null,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              .onConflictDoUpdate({
                target: [problems.contestId, problems.providerProblemKey],
                set: {
                  title: entry.title,
                  url: entry.url,
                  position: entry.position ?? null,
                  points: entry.points ?? null,
                  rating: entry.rating ?? null,
                  tags: entry.tags ?? [],
                  solverCount: entry.solverCount ?? null,
                  attemptCount: entry.attemptCount ?? null,
                  submissionCount: entry.submissionCount ?? null,
                  solveRate: entry.solveRate ?? null,
                  updatedAt: timestamp,
                },
              })
              .run();
          }

          if (entries.length === 0) {
            return [];
          }

          return database.db
            .select()
            .from(problems)
            .where(
              or(
                ...entries.map((entry) =>
                  and(
                    eq(problems.contestId, entry.contestId),
                    eq(problems.providerProblemKey, entry.providerProblemKey),
                  ),
                ),
              )!,
            )
            .all();
        },
        catch: (error) =>
          new PersistenceError({
            code: "problem_upsert_failed",
            message: error instanceof Error ? error.message : "Failed to upsert contest problems.",
          }),
      }),
    getContestById: (contestId) =>
      Effect.try({
        try: () =>
          database.db.select().from(contests).where(eq(contests.id, contestId)).get() ?? null,
        catch: (error) =>
          new PersistenceError({
            code: "contest_get_failed",
            message: error instanceof Error ? error.message : `Failed to load contest ${contestId}.`,
          }),
      }),
    getContestByProviderKey: (provider, providerContestKey) =>
      Effect.try({
        try: () =>
          database.db
            .select()
            .from(contests)
            .where(
              and(
                eq(contests.provider, provider),
                eq(contests.providerContestKey, providerContestKey),
              ),
            )
            .get() ?? null,
        catch: (error) =>
          new PersistenceError({
            code: "contest_get_by_provider_key_failed",
            message:
              error instanceof Error
                ? error.message
                : `Failed to load contest ${provider}:${providerContestKey}.`,
          }),
      }),
    getContestsByIds: (contestIds) =>
      Effect.try({
        try: () => {
          if (contestIds.length === 0) {
            return [];
          }

          return database.db
            .select()
            .from(contests)
            .where(inArray(contests.id, [...contestIds]))
            .all();
        },
        catch: (error) =>
          new PersistenceError({
            code: "contest_list_failed",
            message: error instanceof Error ? error.message : "Failed to load contests.",
          }),
      }),
    listProblemsByContestIds: (contestIds) =>
      Effect.try({
        try: () => {
          if (contestIds.length === 0) {
            return [];
          }

          return database.db
            .select()
            .from(problems)
            .where(inArray(problems.contestId, [...contestIds]))
            .orderBy(asc(problems.contestId), asc(problems.position), asc(problems.providerProblemKey))
            .all();
        },
        catch: (error) =>
          new PersistenceError({
            code: "problem_list_failed",
            message: error instanceof Error ? error.message : "Failed to load contest problems.",
          }),
      }),
    getProblemById: (problemId) =>
      Effect.try({
        try: () =>
          database.db.select().from(problems).where(eq(problems.id, problemId)).get() ?? null,
        catch: (error) =>
          new PersistenceError({
            code: "problem_get_failed",
            message:
              error instanceof Error
                ? error.message
                : `Failed to load problem ${problemId}.`,
          }),
      }),
    listProblemsByIds: (problemIds) =>
      Effect.try({
        try: () => {
          if (problemIds.length === 0) {
            return [];
          }

          return database.db
            .select()
            .from(problems)
            .where(inArray(problems.id, [...problemIds]))
            .all();
        },
        catch: (error) =>
          new PersistenceError({
            code: "problem_list_by_ids_failed",
            message: error instanceof Error ? error.message : "Failed to load problems.",
          }),
      }),
    listUpsolvingContestsForUser: (userId) =>
      Effect.try({
        try: () =>
          database.db
            .select({
              contest: contests,
              state: userContestState,
            })
            .from(userContestState)
            .innerJoin(contests, eq(contests.id, userContestState.contestId))
            .where(
              and(
                eq(userContestState.userId, userId),
                or(
                  eq(userContestState.qualifiesForGymUpsolving, true),
                  eq(userContestState.qualifiesForContestUpsolving, true),
                ),
              ),
            )
            .all(),
        catch: (error) =>
          new PersistenceError({
            code: "contest_list_upsolving_failed",
            message:
              error instanceof Error
                ? error.message
                : `Failed to load upsolving contests for user ${userId}.`,
          }),
      }),
    listQualifiedGymContestsForUser: (userId) =>
      Effect.try({
        try: () =>
          database.db
            .select({
              contest: contests,
              state: userContestState,
            })
            .from(userContestState)
            .innerJoin(contests, eq(contests.id, userContestState.contestId))
            .where(
              and(
                eq(userContestState.userId, userId),
                eq(contests.provider, "codeforces.gym"),
                eq(userContestState.qualifiesForGymFinder, true),
              ),
            )
            .all(),
        catch: (error) =>
          new PersistenceError({
            code: "contest_list_gym_failed",
            message:
              error instanceof Error
                ? error.message
                : `Failed to load gym finder contests for user ${userId}.`,
          }),
      }),
  });
});

export const ContestRepositoryLive = Layer.effect(ContestRepository, makeContestRepository);
