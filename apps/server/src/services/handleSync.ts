import { Context, Effect, Layer } from "effect";

import { ContestRepository } from "../repos/contests.ts";
import { SubmissionRepository } from "../repos/submissions.ts";
import { UserRepository } from "../repos/users.ts";
import { CACHE_KEYS, CONTEST_PROVIDERS } from "../lib/constants.ts";
import { normalizeHandleKey } from "../lib/handles.ts";
import { nowIso } from "../lib/time.ts";
import { SyncError } from "../errors/sync.ts";
import { CodeforcesClient } from "./codeforcesClient.ts";
import { CacheRepository } from "../repos/cache.ts";
import type { CodeforcesContest } from "./codeforcesClient.ts";

const STATUS_PAGE_SIZE = 100_000;
const GYM_CONTEST_ID_START = 100_000;

function isGymContestId(contestId: number) {
  return contestId >= GYM_CONTEST_ID_START;
}

export interface HandleSyncResult {
  readonly canonicalHandle: string;
  readonly syncedContestIds: ReadonlyArray<number>;
}

export interface HandleSyncServiceShape {
  readonly syncHandle: (
    handle: string,
    force?: boolean,
  ) => Effect.Effect<HandleSyncResult, SyncError>;
}

export class HandleSyncService extends Context.Tag("icpc-trainer/HandleSyncService")<
  HandleSyncService,
  HandleSyncServiceShape
>() {}

function toSubmissionTimestamp(creationTimeSeconds?: number) {
  return creationTimeSeconds
    ? new Date(creationTimeSeconds * 1_000).toISOString()
    : nowIso();
}

function toContestUrl(provider: (typeof CONTEST_PROVIDERS)[number], contestId: number) {
  return provider === "codeforces.gym"
    ? `https://codeforces.com/gym/${contestId}`
    : `https://codeforces.com/contest/${contestId}`;
}

export const makeHandleSyncService = Effect.gen(function* () {
  const codeforcesClient = yield* CodeforcesClient;
  const cacheRepository = yield* CacheRepository;
  const userRepository = yield* UserRepository;
  const contestRepository = yield* ContestRepository;
  const submissionRepository = yield* SubmissionRepository;

  const syncHandle = Effect.fn("handleSync.syncHandle")(function* (
    handle: string,
    _force = false,
  ) {
    const timestamp = nowIso();
    const existingUser = yield* userRepository.findByHandle(handle).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "handle_user_lookup_failed",
            message: error.message,
          }),
      ),
    );
    const canonicalHandle = existingUser?.username ?? (yield* codeforcesClient.getUserInfo(handle).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "handle_lookup_failed",
            message: error.message,
          }),
      ),
      Effect.flatMap((userInfo) =>
        userInfo
          ? Effect.succeed(userInfo.handle)
          : Effect.fail(
              new SyncError({
                code: "handle_not_found",
                message: `Codeforces handle ${handle} does not exist.`,
              }),
            ),
      ),
    ));
    const user = yield* userRepository.upsertCodeforcesUser({
      providerUserKey: normalizeHandleKey(canonicalHandle),
      username: canonicalHandle,
      lastProgressSyncedAt: timestamp,
    }).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "handle_user_upsert_failed",
            message: error.message,
          }),
      ),
    );

    const submissions: import("./codeforcesClient.ts").CodeforcesSubmission[] = [];
    for (let from = 1; ; from += STATUS_PAGE_SIZE) {
      const page = yield* codeforcesClient.getUserStatusPage(
        canonicalHandle,
        from,
        STATUS_PAGE_SIZE,
      ).pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "user_status_page_failed",
              message: error.message,
            }),
        ),
      );
      const existingSubmissionIds = new Set(
        yield* submissionRepository
          .listExistingExternalSubmissionIds(
            user.id,
            page.map((submission) => String(submission.id)),
          )
          .pipe(
            Effect.mapError(
              (error) =>
                new SyncError({
                  code: "submission_existing_ids_failed",
                  message: error.message,
                }),
            ),
          ),
      );

      const firstRepeatIndex = page.findIndex((submission) =>
        existingSubmissionIds.has(String(submission.id)),
      );
      submissions.push(
        ...(firstRepeatIndex === -1 ? page : page.slice(0, firstRepeatIndex + 1)),
      );
      if (page.length < STATUS_PAGE_SIZE) {
        break;
      }
      if (firstRepeatIndex !== -1) {
        break;
      }
    }

    const contestRowsByKey = new Map<string, number>();
    const contestSyncStateById = new Map<number, string>();
    const touchedContestIds = new Set<number>();
    const problemRowsByKey = new Map<string, number>();
    const existingProblemRowsByContestId = new Map<number, Map<string, number>>();
    const cachedCatalog = yield* cacheRepository
      .getJson<ReadonlyArray<CodeforcesContest>>(CACHE_KEYS.contestCatalogPayload)
      .pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "contest_catalog_payload_load_failed",
              message: error.message,
            }),
        ),
      );
    const contestMetadata = new Map((cachedCatalog ?? []).map((contest) => [contest.id, contest]));

    for (const submission of submissions) {
      const contestId = submission.problem.contestId ?? submission.contestId;
      if (!contestId) {
        continue;
      }

      const provider = isGymContestId(contestId) ? "codeforces.gym" : "codeforces.contest";
      const providerContestKey = String(contestId);
      const contestKey = `${provider}:${providerContestKey}`;
      let storedContestId = contestRowsByKey.get(contestKey);

      if (!storedContestId) {
        const existingContest = yield* contestRepository.getContestByProviderKey(
          provider,
          providerContestKey,
        ).pipe(
          Effect.mapError(
            (error) =>
              new SyncError({
                code: "contest_lookup_failed",
                message: error.message,
              }),
          ),
        );
        const contest = existingContest ?? (yield* Effect.gen(function* () {
          const metadata = contestMetadata.get(contestId);
          return yield* contestRepository.upsertContest({
            provider,
            providerContestKey,
            title: metadata?.name ?? `Contest ${contestId}`,
            url: toContestUrl(provider, contestId),
            startsAt: metadata?.startTimeSeconds
              ? new Date(metadata.startTimeSeconds * 1_000).toISOString()
              : null,
            participantCount: null,
            syncState: "pending",
          }).pipe(
            Effect.mapError(
              (error) =>
                new SyncError({
                  code: "contest_upsert_failed",
                  message: error.message,
                }),
            ),
          );
        }));
        storedContestId = contest.id;
        contestRowsByKey.set(contestKey, storedContestId);
        contestSyncStateById.set(storedContestId, contest.syncState);
      }

      touchedContestIds.add(storedContestId);

      const problemKey = `${contestId}:${submission.problem.index}`;
      if (problemRowsByKey.has(problemKey)) {
        continue;
      }

      if (contestSyncStateById.get(storedContestId) === "ready") {
        let existingProblemRows = existingProblemRowsByContestId.get(storedContestId);
        if (!existingProblemRows) {
          const contestProblems = yield* contestRepository
            .listProblemsByContestIds([storedContestId])
            .pipe(
              Effect.mapError(
                (error) =>
                  new SyncError({
                    code: "problem_list_failed",
                    message: error.message,
                  }),
              ),
            );
          existingProblemRows = new Map(
            contestProblems.map((problem) => [problem.providerProblemKey, problem.id]),
          );
          existingProblemRowsByContestId.set(storedContestId, existingProblemRows);
        }

        const existingProblemId = existingProblemRows.get(submission.problem.index);
        if (existingProblemId) {
          problemRowsByKey.set(problemKey, existingProblemId);
          continue;
        }
      }

      const [problemRow] = yield* contestRepository.upsertProblems([
        {
          contestId: storedContestId,
          providerProblemKey: submission.problem.index,
          title: submission.problem.name,
          url:
            provider === "codeforces.gym"
              ? `https://codeforces.com/gym/${contestId}/problem/${submission.problem.index}`
              : `https://codeforces.com/contest/${contestId}/problem/${submission.problem.index}`,
          position: null,
          points: submission.problem.points ?? null,
          rating: submission.problem.rating ?? null,
          tags: submission.problem.tags ?? [],
          solverCount: null,
          solveRate: null,
        },
      ]).pipe(
        Effect.mapError(
          (error) =>
            new SyncError({
              code: "problem_upsert_failed",
              message: error.message,
            }),
        ),
      );

      if (!problemRow) {
        return yield* Effect.fail(
          new SyncError({
            code: "problem_missing_after_upsert",
            message: `Problem ${problemKey} was not found after upsert.`,
          }),
        );
      }

      problemRowsByKey.set(problemKey, problemRow.id);
    }

    const syncedSubmissions = submissions.flatMap((submission) => {
      const contestId = submission.problem.contestId ?? submission.contestId;
      if (!contestId) {
        return [];
      }

      const provider = isGymContestId(contestId) ? "codeforces.gym" : "codeforces.contest";
      const storedContestId = contestRowsByKey.get(`${provider}:${contestId}`);
      const storedProblemId = problemRowsByKey.get(`${contestId}:${submission.problem.index}`);
      if (!storedContestId || !storedProblemId) {
        return [];
      }

      return [
        {
          contestId: storedContestId,
          problemId: storedProblemId,
          externalSubmissionId: String(submission.id),
          verdict: submission.verdict ?? "UNKNOWN",
          submittedAt: toSubmissionTimestamp(submission.creationTimeSeconds),
        },
      ];
    });

    yield* submissionRepository.upsertUserSubmissions(user.id, syncedSubmissions).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "submission_upsert_failed",
            message: error.message,
          }),
      ),
    );

    yield* userRepository.touchLastProgressSyncedAt(user.id, timestamp).pipe(
      Effect.mapError(
        (error) =>
          new SyncError({
            code: "user_touch_sync_failed",
            message: error.message,
          }),
      ),
    );

    return {
      canonicalHandle,
      syncedContestIds: [...touchedContestIds],
    } satisfies HandleSyncResult;
  });

  return HandleSyncService.of({
    syncHandle,
  });
});

export const HandleSyncServiceLive = Layer.effect(
  HandleSyncService,
  makeHandleSyncService,
);
