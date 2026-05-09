import { Context, Effect, Layer } from "effect";

import type {
  CompleteUpsolvingProblemResponse,
  CompleteUpsolvingProblemsResponse,
  SyncUpsolvingResponse,
  UpsolvingContest,
  UpsolvingContestDetailResponse,
  UpsolvingOverviewResponse,
  UpsolvingProgress,
} from "../contracts/upsolving.ts";
import { UpsolvingError } from "../errors/upsolving.ts";
import { ContestRepository } from "../repos/contests.ts";
import { SubmissionRepository } from "../repos/submissions.ts";
import { UserRepository } from "../repos/users.ts";
import { normalizeHandleKey } from "../lib/handles.ts";
import { nowIso } from "../lib/time.ts";
import { CatalogSyncService } from "./catalogSync.ts";
import { CodeforcesClient } from "./codeforcesClient.ts";
import { SessionService } from "./session.ts";
import { UpsolvingEventService } from "./upsolvingEvents.ts";

export interface UpsolvingServiceShape {
  readonly syncCurrentContext: (
    force?: boolean,
  ) => Effect.Effect<SyncUpsolvingResponse, UpsolvingError>;
  readonly buildUpsolvingView: () => Effect.Effect<UpsolvingOverviewResponse, UpsolvingError>;
  readonly buildContestView: (
    contestId: number,
  ) => Effect.Effect<UpsolvingContestDetailResponse, UpsolvingError>;
  readonly completeProblem: (
    problemId: number,
  ) => Effect.Effect<CompleteUpsolvingProblemResponse, UpsolvingError>;
  readonly completeProblems: (
    problemIds: ReadonlyArray<number>,
  ) => Effect.Effect<CompleteUpsolvingProblemsResponse, UpsolvingError>;
}

export class UpsolvingService extends Context.Tag("icpc-trainer/UpsolvingService")<
  UpsolvingService,
  UpsolvingServiceShape
>() {}

function toContestTimestamp(seconds?: number) {
  return seconds ? new Date(seconds * 1_000).toISOString() : null;
}

const GYM_STANDINGS_ROW_COUNT = 10_000;

function hasGymStandingSnapshot(
  contest: typeof import("../db/schema.ts").contests.$inferSelect,
) {
  return contest.syncState === "ready" && contest.syncedAt !== null;
}

function standingsParticipantKey(
  row: import("./codeforcesClient.ts").CodeforcesStandingsRow,
  rowIndex: number,
) {
  const members = row.party.members
    .map((member) => member.handle ?? member.name)
    .filter((member): member is string => Boolean(member))
    .map(normalizeHandleKey)
    .sort();

  return members.length > 0 ? members.join(",") : `row:${rowIndex}`;
}

export const makeUpsolvingService = Effect.gen(function* () {
  const sessionService = yield* SessionService;
  const contestRepository = yield* ContestRepository;
  const submissionRepository = yield* SubmissionRepository;
  const userRepository = yield* UserRepository;
  const codeforcesClient = yield* CodeforcesClient;
  const catalogSyncService = yield* CatalogSyncService;
  const upsolvingEvents = yield* UpsolvingEventService;

  const buildContestEntry = (
    entry: {
      readonly contest: typeof import("../db/schema.ts").contests.$inferSelect;
      readonly state: typeof import("../db/schema.ts").userContestState.$inferSelect;
    },
    problemRows: ReadonlyArray<typeof import("../db/schema.ts").problems.$inferSelect>,
    currentStates: ReadonlyArray<
      typeof import("../db/schema.ts").userProblemState.$inferSelect
    >,
    teammateStates: ReadonlyArray<
      typeof import("../db/schema.ts").userProblemState.$inferSelect
    >,
  ): UpsolvingContest => {
    const currentStatesByProblemId = new Map<number, Array<typeof currentStates[number]>>();
    for (const state of currentStates) {
      const bucket = currentStatesByProblemId.get(state.problemId) ?? [];
      bucket.push(state);
      currentStatesByProblemId.set(state.problemId, bucket);
    }
    const teammateStatesByProblemId = new Map<number, Array<typeof teammateStates[number]>>();
    for (const state of teammateStates) {
      const bucket = teammateStatesByProblemId.get(state.problemId) ?? [];
      bucket.push(state);
      teammateStatesByProblemId.set(state.problemId, bucket);
    }

    return {
      contest: {
        id: entry.contest.id,
        provider: entry.contest.provider as "codeforces.gym" | "codeforces.contest",
        providerContestKey: entry.contest.providerContestKey,
        title: entry.contest.title,
        url: entry.contest.url,
        startsAt: entry.contest.startsAt,
        participantCount: entry.contest.participantCount,
      },
      submissionCount: entry.state.submissionCount,
      acceptedCount: entry.state.acceptedCount,
      problems: problemRows.map((problem) => {
        const currentProblemStates = currentStatesByProblemId.get(problem.id) ?? [];
        const teamStates = teammateStatesByProblemId.get(problem.id) ?? [];
        return {
          id: problem.id,
          contestId: problem.contestId,
          providerProblemKey: problem.providerProblemKey,
          title: problem.title,
          url: problem.url,
          position: problem.position,
          points: problem.points,
          rating: problem.rating,
          tags: problem.tags,
          solverCount: problem.solverCount,
          attemptCount: problem.attemptCount,
          submissionCount: problem.submissionCount,
          solveRate: problem.solveRate,
          attempted: currentProblemStates.some((state) => state.attempted),
          passed: currentProblemStates.some((state) => state.passed),
          team: {
            attemptedByTeam: teamStates.some((state) => state.attempted),
            solvedByTeam: teamStates.some((state) => state.passed),
          },
        };
      }),
    };
  };

  const mergeContestEntries = (
    entries: ReadonlyArray<{
      readonly contest: typeof import("../db/schema.ts").contests.$inferSelect;
      readonly state: typeof import("../db/schema.ts").userContestState.$inferSelect;
    }>,
  ) => {
    const byContestId = new Map<number, typeof entries[number]>();
    for (const entry of entries) {
      const existing = byContestId.get(entry.contest.id);
      if (!existing) {
        byContestId.set(entry.contest.id, entry);
        continue;
      }

      byContestId.set(entry.contest.id, {
        contest: entry.contest,
        state: {
          ...existing.state,
          submissionCount: existing.state.submissionCount + entry.state.submissionCount,
          acceptedCount: existing.state.acceptedCount + entry.state.acceptedCount,
          qualifiesForGymFinder:
            existing.state.qualifiesForGymFinder || entry.state.qualifiesForGymFinder,
          qualifiesForGymUpsolving:
            existing.state.qualifiesForGymUpsolving || entry.state.qualifiesForGymUpsolving,
          qualifiesForContestUpsolving:
            existing.state.qualifiesForContestUpsolving ||
            entry.state.qualifiesForContestUpsolving,
          lastSubmissionAt:
            [existing.state.lastSubmissionAt, entry.state.lastSubmissionAt]
              .filter((value): value is string => Boolean(value))
              .sort((left, right) => right.localeCompare(left))[0] ?? null,
        },
      });
    }

    return [...byContestId.values()];
  };

  const filterContestsWithTwoDistinctProblems = Effect.fn(
    "upsolving.filterContestsWithTwoDistinctProblems",
  )(function* (
    entries: ReadonlyArray<ReturnType<typeof mergeContestEntries>[number]>,
    userIds: ReadonlyArray<number>,
  ) {
    const attemptedProblems = yield* submissionRepository
      .listAttemptedProblemIdsByContestForUsers(
        userIds,
        entries.map((entry) => entry.contest.id),
      )
      .pipe(
        Effect.mapError(
          (error) =>
            new UpsolvingError({
              code: "attempted_problem_load_failed",
              message: error.message,
            }),
        ),
      );
    const attemptedProblemIdsByContestId = new Map<number, Set<number>>();
    for (const row of attemptedProblems) {
      const bucket = attemptedProblemIdsByContestId.get(row.contestId) ?? new Set<number>();
      bucket.add(row.problemId);
      attemptedProblemIdsByContestId.set(row.contestId, bucket);
    }

    return entries.filter(
      (entry) => (attemptedProblemIdsByContestId.get(entry.contest.id)?.size ?? 0) >= 2,
    );
  });

  const ensureGymContestSnapshot = Effect.fn("upsolving.ensureGymContestSnapshot")(function* (
    contest: typeof import("../db/schema.ts").contests.$inferSelect,
    trackedUsers: ReadonlyArray<{ readonly id: number; readonly username: string }>,
  ) {
    const credentials = yield* sessionService.requireCodeforcesCredentials().pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: error.code,
            message: error.message,
          }),
      ),
    );
    const standings = yield* codeforcesClient.getSignedContestStandingsPage(
      Number(contest.providerContestKey),
      1,
      GYM_STANDINGS_ROW_COUNT,
      true,
      credentials.apiKey,
      credentials.apiSecret,
    ).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "gym_standings_failed",
            message: error.message,
          }),
      ),
    );

    const problemTryerRowsByIndex = new Map<string, Set<string>>();
    standings.rows.forEach((row, rowIndex) => {
      const participantKey = standingsParticipantKey(row, rowIndex);
      for (const [index, result] of row.problemResults.entries()) {
        const problem = standings.problems[index];
        if (!problem) {
          continue;
        }
        const solved =
          (result.points ?? 0) > 0 || result.bestSubmissionTimeSeconds !== undefined;
        const rejectedAttemptCount = result.rejectedAttemptCount ?? 0;
        const submissionCount = rejectedAttemptCount + (solved ? 1 : 0);
        if (submissionCount > 0) {
          const tryerRows = problemTryerRowsByIndex.get(problem.index) ?? new Set<string>();
          tryerRows.add(participantKey);
          problemTryerRowsByIndex.set(problem.index, tryerRows);
        }
      }
    });
    const maxProblemTryerCount = Math.max(
      0,
      ...[...problemTryerRowsByIndex.values()].map((tryerRows) => tryerRows.size),
    );

    yield* contestRepository.upsertContest({
      provider: contest.provider,
      providerContestKey: contest.providerContestKey,
      title: standings.contest.name,
      url: contest.url,
      startsAt: toContestTimestamp(standings.contest.startTimeSeconds),
      participantCount: maxProblemTryerCount,
      syncState: "ready",
      syncError: null,
      lastSyncAttemptedAt: nowIso(),
      syncedAt: nowIso(),
    }).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "gym_contest_upsert_failed",
            message: error.message,
          }),
      ),
    );

    yield* contestRepository.upsertProblems(
      standings.problems.map((problem, index) => ({
        contestId: contest.id,
        providerProblemKey: problem.index,
        title: problem.name,
        url: `https://codeforces.com/gym/${contest.providerContestKey}/problem/${problem.index}`,
        position: index + 1,
        points: problem.points ?? null,
        rating: problem.rating ?? null,
        tags: problem.tags ?? [],
        solverCount: null,
        attemptCount: maxProblemTryerCount,
        submissionCount: problemTryerRowsByIndex.get(problem.index)?.size ?? 0,
        solveRate:
          maxProblemTryerCount > 0
            ? Number(
                (
                  (problemTryerRowsByIndex.get(problem.index)?.size ?? 0) /
                  maxProblemTryerCount
                ).toFixed(4),
              )
            : null,
      })),
    ).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "gym_problem_upsert_failed",
            message: error.message,
          }),
      ),
    );

    const savedProblems = yield* contestRepository.listProblemsByContestIds([contest.id]).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "gym_problem_state_problem_load_failed",
            message: error.message,
          }),
      ),
    );
    const problemIdByIndex = new Map(
      savedProblems.map((problem) => [problem.providerProblemKey, problem.id]),
    );
    const userIdByHandle = new Map(
      trackedUsers.map((user) => [normalizeHandleKey(user.username), user.id]),
    );
    const inferredStates = [];
    for (const row of standings.rows) {
      const handle = row.party.members
        .map((member) => member.handle)
        .find((memberHandle): memberHandle is string => Boolean(memberHandle));
      const userId = handle ? userIdByHandle.get(normalizeHandleKey(handle)) : undefined;
      if (!userId) {
        continue;
      }

      for (const [index, result] of row.problemResults.entries()) {
        const problem = standings.problems[index];
        const problemId = problem ? problemIdByIndex.get(problem.index) : undefined;
        if (!problemId) {
          continue;
        }

        const passed = (result.points ?? 0) > 0 || result.bestSubmissionTimeSeconds !== undefined;
        const attempted = passed || (result.rejectedAttemptCount ?? 0) > 0;
        if (!attempted) {
          continue;
        }

        inferredStates.push({
          userId,
          problemId,
          attempted,
          passed,
          lastSubmissionAt: result.bestSubmissionTimeSeconds !== undefined &&
            standings.contest.startTimeSeconds !== undefined
            ? new Date(
                (standings.contest.startTimeSeconds + result.bestSubmissionTimeSeconds) *
                  1_000,
              ).toISOString()
            : null,
        });
      }
    }

    yield* submissionRepository.upsertProblemStates(inferredStates).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "gym_problem_state_upsert_failed",
            message: error.message,
          }),
      ),
    );
  });

  const ensureRegularContestProblems = Effect.fn("upsolving.ensureRegularContestProblems")(function* (
    contests: ReadonlyArray<typeof import("../db/schema.ts").contests.$inferSelect>,
  ) {
    const snapshot = yield* catalogSyncService.syncCatalogsIfStale(false).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "problemset_sync_failed",
            message: error.message,
          }),
      ),
    );

    const solvedCountByKey = new Map<string, number>();
    for (const statistic of snapshot.problemset.problemStatistics) {
      if (!statistic.contestId) {
        continue;
      }
      solvedCountByKey.set(`${statistic.contestId}:${statistic.index}`, statistic.solvedCount);
    }

    for (const contest of contests) {
      const externalContestId = Number(contest.providerContestKey);
      const problems = snapshot.problemset.problems.filter(
        (problem) => problem.contestId === externalContestId,
      );
      if (problems.length === 0) {
        continue;
      }

      yield* contestRepository.upsertProblems(
        problems.map((problem, index) => ({
          contestId: contest.id,
          providerProblemKey: problem.index,
          title: problem.name,
          url: `https://codeforces.com/contest/${contest.providerContestKey}/problem/${problem.index}`,
          position: index + 1,
          points: problem.points ?? null,
          rating: problem.rating ?? null,
          tags: problem.tags ?? [],
          solverCount: solvedCountByKey.get(`${externalContestId}:${problem.index}`) ?? null,
          attemptCount: null,
          submissionCount: null,
          solveRate: null,
        })),
      ).pipe(
        Effect.mapError(
          (error) =>
            new UpsolvingError({
              code: "contest_problem_upsert_failed",
              message: error.message,
            }),
        ),
      );
    }
  });

  const buildUpsolvingView = Effect.fn("upsolving.buildUpsolvingView")(function* () {
    const session = yield* sessionService.requireSession().pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: error.code,
            message: error.message,
          }),
      ),
    );
    const teammates = yield* userRepository.listByRole("teammate").pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "teammate_roster_load_failed",
            message: error.message,
          }),
      ),
    );
    const primaryUsers = [
      { id: session.currentUser.id, username: session.currentUser.username },
      ...teammates.map((entry) => ({
        id: entry.user.id,
        username: entry.user.username,
      })),
    ];
    const primaryUserIds = [...new Set(primaryUsers.map((user) => user.id))];
    const primaryContestEntries = [];
    for (const userId of primaryUserIds) {
      const userEntries = yield* contestRepository.listUpsolvingContestsForUser(userId).pipe(
        Effect.mapError(
          (error) =>
            new UpsolvingError({
              code: "upsolving_contests_load_failed",
              message: error.message,
            }),
        ),
      );
      primaryContestEntries.push(...userEntries);
    }
    const entries = mergeContestEntries(primaryContestEntries);

    const qualifiedEntries = yield* filterContestsWithTwoDistinctProblems(
      entries,
      primaryUserIds,
    );
    const gymEntries = qualifiedEntries.filter(
      (entry) => entry.contest.provider === "codeforces.gym" && entry.state.submissionCount >= 2,
    );
    const regularEntries = qualifiedEntries.filter(
      (entry) =>
        entry.contest.provider === "codeforces.contest" && entry.state.submissionCount >= 2,
    );
    const allContests = [...gymEntries, ...regularEntries];
    const allContestIds = allContests.map((entry) => entry.contest.id);
    const problemRows = yield* contestRepository.listProblemsByContestIds(allContestIds).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "problem_load_failed",
            message: error.message,
        }),
      ),
    );

    const problemIds = problemRows.map((problem) => problem.id);
    const readyGymContestIds = new Set(
      gymEntries
        .filter((entry) => hasGymStandingSnapshot(entry.contest))
        .map((entry) => entry.contest.id),
    );
    const readyRegularContestIds = new Set(
      problemRows
        .filter((problem) =>
          regularEntries.some((entry) => entry.contest.id === problem.contestId),
        )
        .map((problem) => problem.contestId),
    );
    const readyContestIds = new Set([...readyGymContestIds, ...readyRegularContestIds]);
    const remainingPendingGym = gymEntries.find(
      (entry) => !hasGymStandingSnapshot(entry.contest),
    );

    const currentUserStates = yield* submissionRepository.listProblemStatesForUsers(
      primaryUserIds,
      problemIds,
    ).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "current_problem_state_failed",
            message: error.message,
          }),
      ),
    );
    const teammateStates = yield* submissionRepository.listProblemStatesForUsers(
      primaryUserIds,
      problemIds,
    ).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "team_problem_state_failed",
            message: error.message,
          }),
      ),
    );

    const problemsByContestId = new Map<number, Array<typeof problemRows[number]>>();
    for (const problem of problemRows) {
      const bucket = problemsByContestId.get(problem.contestId) ?? [];
      bucket.push(problem);
      problemsByContestId.set(problem.contestId, bucket);
    }

    const toContestEntry = (entry: typeof allContests[number]): UpsolvingContest => {
      const contestProblems = problemsByContestId.get(entry.contest.id) ?? [];
      const contestProblemIds = new Set(contestProblems.map((problem) => problem.id));
      return buildContestEntry(
        entry,
        contestProblems,
        currentUserStates.filter((state) => contestProblemIds.has(state.problemId)),
        teammateStates.filter((state) => contestProblemIds.has(state.problemId)),
      );
    };

    return {
      gyms: gymEntries.map(toContestEntry),
      contests: regularEntries.map(toContestEntry),
      progress: {
        totalContestCount: allContests.length,
        readyContestCount: readyContestIds.size,
        pendingContestCount: Math.max(0, allContests.length - readyContestIds.size),
        totalGymCount: gymEntries.length,
        readyGymCount: readyGymContestIds.size,
        pendingGymCount: Math.max(0, gymEntries.length - readyGymContestIds.size),
        activeGymTitle: remainingPendingGym?.contest.title ?? null,
      },
    } satisfies UpsolvingOverviewResponse;
  });

  const buildContestView = Effect.fn("upsolving.buildContestView")(function* (contestId: number) {
    const overview = yield* buildUpsolvingView();
    const entry = [...overview.gyms, ...overview.contests].find(
      (item) => item.contest.id === contestId,
    );
    if (!entry) {
      return yield* Effect.fail(
        new UpsolvingError({
          code: "contest_not_found",
          message: `Contest ${contestId} is not available in the upsolving view.`,
        }),
      );
    }

    return {
      entry,
    } satisfies UpsolvingContestDetailResponse;
  });

  const completeProblem = Effect.fn("upsolving.completeProblem")(function* (problemId: number) {
    const session = yield* sessionService.requireSession().pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: error.code,
            message: error.message,
          }),
      ),
    );
    const problem = yield* contestRepository.getProblemById(problemId).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "problem_load_failed",
            message: error.message,
          }),
      ),
    );
    if (!problem) {
      return yield* Effect.fail(
        new UpsolvingError({
          code: "problem_not_found",
          message: `Problem ${problemId} is not available in the upsolving view.`,
        }),
      );
    }

    const completedAt = nowIso();
    yield* submissionRepository.upsertUserSubmissions(session.currentUser.id, [
      {
        contestId: problem.contestId,
        problemId,
        externalSubmissionId: `manual-complete:${problemId}`,
        verdict: "OK",
        submittedAt: completedAt,
      },
    ]).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "problem_complete_failed",
            message: error.message,
          }),
      ),
    );

    return {
      ok: true,
      problemId,
    } satisfies CompleteUpsolvingProblemResponse;
  });

  const completeProblems = Effect.fn("upsolving.completeProblems")(function* (
    problemIds: ReadonlyArray<number>,
  ) {
    const session = yield* sessionService.requireSession().pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: error.code,
            message: error.message,
          }),
      ),
    );
    const uniqueProblemIds = [...new Set(problemIds)];
    if (uniqueProblemIds.length === 0) {
      return {
        ok: true,
        problemIds: [],
      } satisfies CompleteUpsolvingProblemsResponse;
    }

    const problems = yield* contestRepository.listProblemsByIds(uniqueProblemIds).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "problem_load_failed",
            message: error.message,
          }),
      ),
    );
    if (problems.length !== uniqueProblemIds.length) {
      const foundProblemIds = new Set(problems.map((problem) => problem.id));
      const missingProblemIds = uniqueProblemIds.filter(
        (problemId) => !foundProblemIds.has(problemId),
      );
      return yield* Effect.fail(
        new UpsolvingError({
          code: "problem_not_found",
          message: `Problems ${missingProblemIds.join(", ")} are not available in the upsolving view.`,
        }),
      );
    }

    const completedAt = nowIso();
    yield* submissionRepository.upsertUserSubmissions(
      session.currentUser.id,
      problems.map((problem) => ({
        contestId: problem.contestId,
        problemId: problem.id,
        externalSubmissionId: `manual-complete:${problem.id}`,
        verdict: "OK",
        submittedAt: completedAt,
      })),
    ).pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "problem_complete_failed",
            message: error.message,
          }),
      ),
    );

    return {
      ok: true,
      problemIds: uniqueProblemIds,
    } satisfies CompleteUpsolvingProblemsResponse;
  });

  const syncCurrentContext = Effect.fn("upsolving.syncCurrentContext")(function* (_force = false) {
    const session = yield* sessionService.requireSession().pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: error.code,
            message: error.message,
          }),
      ),
    );

    const teammates = yield* userRepository.listByRole("teammate").pipe(
      Effect.mapError(
        (error) =>
          new UpsolvingError({
            code: "teammate_roster_load_failed",
            message: error.message,
          }),
      ),
    );
    const primaryUsers = [
      { id: session.currentUser.id, username: session.currentUser.username },
      ...teammates.map((entry) => ({
        id: entry.user.id,
        username: entry.user.username,
      })),
    ];
    const primaryUserIds = [...new Set(primaryUsers.map((user) => user.id))];
    const primaryContestEntries = [];
    for (const userId of primaryUserIds) {
      const userEntries = yield* contestRepository.listUpsolvingContestsForUser(userId).pipe(
        Effect.mapError(
          (error) =>
            new UpsolvingError({
              code: "upsolving_contests_load_failed",
              message: error.message,
            }),
        ),
      );
      primaryContestEntries.push(...userEntries);
    }
    const entries = mergeContestEntries(primaryContestEntries);
    const qualifiedEntries = yield* filterContestsWithTwoDistinctProblems(
      entries,
      primaryUserIds,
    );
    const gymEntries = qualifiedEntries.filter(
      (entry) => entry.contest.provider === "codeforces.gym" && entry.state.submissionCount >= 2,
    );
    const regularEntries = qualifiedEntries.filter(
      (entry) =>
        entry.contest.provider === "codeforces.contest" && entry.state.submissionCount >= 2,
    );

    const totalContestCount = gymEntries.length;
    const makeProgress = (
      readyGymCount: number,
      activeGymTitle: string | null,
    ): UpsolvingProgress => {
      return {
        totalContestCount,
        readyContestCount: readyGymCount,
        pendingContestCount: Math.max(0, totalContestCount - readyGymCount),
        totalGymCount: gymEntries.length,
        readyGymCount,
        pendingGymCount: Math.max(0, gymEntries.length - readyGymCount),
        activeGymTitle,
      };
    };

    const pendingGyms = gymEntries.filter((entry) => !hasGymStandingSnapshot(entry.contest));
    const gymsNeedingSnapshot = pendingGyms;
    let readyGymCount = gymEntries.length - pendingGyms.length;
    if (pendingGyms.length > 0) {
      yield* upsolvingEvents.publish({
        type: "sync.progress",
        progress: makeProgress(readyGymCount, pendingGyms[0]?.contest.title ?? null),
      });
    }
    for (const gymEntry of gymsNeedingSnapshot) {
      const wasPending = !hasGymStandingSnapshot(gymEntry.contest);
      yield* ensureGymContestSnapshot(gymEntry.contest, [
        ...primaryUsers,
      ]);
      if (wasPending) {
        readyGymCount += 1;
      }
      const [updatedContest] = yield* contestRepository
        .getContestsByIds([gymEntry.contest.id])
        .pipe(
          Effect.mapError(
            (error) =>
              new UpsolvingError({
                code: "gym_contest_reload_failed",
                message: error.message,
              }),
          ),
        );
      const updatedProblems = yield* contestRepository
        .listProblemsByContestIds([gymEntry.contest.id])
        .pipe(
          Effect.mapError(
            (error) =>
              new UpsolvingError({
                code: "gym_problem_reload_failed",
                message: error.message,
              }),
          ),
        );
      const updatedProblemIds = updatedProblems.map((problem) => problem.id);
      const currentUserStates = yield* submissionRepository
        .listProblemStatesForUsers(primaryUserIds, updatedProblemIds)
        .pipe(
          Effect.mapError(
            (error) =>
              new UpsolvingError({
                code: "current_problem_state_failed",
                message: error.message,
              }),
          ),
        );
      const teammateStates = yield* submissionRepository
        .listProblemStatesForUsers(primaryUserIds, updatedProblemIds)
        .pipe(
          Effect.mapError(
            (error) =>
              new UpsolvingError({
                code: "team_problem_state_failed",
                message: error.message,
              }),
          ),
        );
      yield* upsolvingEvents.publish({
        type: readyGymCount === gymEntries.length ? "sync.completed" : "sync.progress",
        progress: makeProgress(
          readyGymCount,
          readyGymCount === gymEntries.length
            ? null
            : pendingGyms[readyGymCount - (gymEntries.length - pendingGyms.length)]?.contest
                .title ?? null,
        ),
        contest: updatedContest
          ? buildContestEntry(
              { contest: updatedContest, state: gymEntry.state },
              updatedProblems,
              currentUserStates,
              teammateStates,
            )
          : undefined,
      });
    }

    yield* ensureRegularContestProblems(regularEntries.map((entry) => entry.contest));

    return {
      ok: true,
      syncedContestIds: [],
    } satisfies SyncUpsolvingResponse;
  });

  return UpsolvingService.of({
    syncCurrentContext,
    buildUpsolvingView,
    buildContestView,
    completeProblem,
    completeProblems,
  });
});

export const UpsolvingServiceLive = Layer.effect(
  UpsolvingService,
  makeUpsolvingService,
);
