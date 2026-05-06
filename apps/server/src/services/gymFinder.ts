import { Context, Effect, Layer } from "effect";

import type { GymFinderResponse } from "../contracts/gymFinder.ts";
import { GymFinderError } from "../errors/gymFinder.ts";
import { CACHE_KEYS } from "../lib/constants.ts";
import { CacheRepository } from "../repos/cache.ts";
import { ContestRepository } from "../repos/contests.ts";
import { UserRepository } from "../repos/users.ts";
import type { CodeforcesContest } from "./codeforcesClient.ts";
import { SessionService } from "./session.ts";

const MAX_GYM_FINDER_RESULTS = 10;

export interface GymFinderServiceShape {
  readonly buildGymFinderRankings: () => Effect.Effect<GymFinderResponse, GymFinderError>;
}

export class GymFinderService extends Context.Tag("icpc-trainer/GymFinderService")<
  GymFinderService,
  GymFinderServiceShape
>() {}

export const makeGymFinderService = Effect.gen(function* () {
  const sessionService = yield* SessionService;
  const cacheRepository = yield* CacheRepository;
  const contestRepository = yield* ContestRepository;
  const userRepository = yield* UserRepository;

  const buildGymFinderRankings = Effect.fn("gymFinder.buildGymFinderRankings")(function* () {
    const session = yield* sessionService.requireSession().pipe(
      Effect.mapError(
        (error) =>
          new GymFinderError({
            code: error.code,
            message: error.message,
          }),
      ),
    );

    const teammates = yield* userRepository.listByRole("teammate").pipe(
      Effect.mapError(
        (error) =>
          new GymFinderError({
            code: "teammate_roster_load_failed",
            message: error.message,
          }),
      ),
    );
    const primaryUserIds = [
      session.currentUser.id,
      ...teammates.map((entry) => entry.user.id),
    ];
    const currentUserContestIds = new Set<number>();
    for (const userId of new Set(primaryUserIds)) {
      const primaryContests = yield* contestRepository.listQualifiedGymContestsForUser(userId).pipe(
        Effect.mapError(
          (error) =>
            new GymFinderError({
              code: "primary_user_gyms_failed",
              message: error.message,
            }),
        ),
      );
      for (const entry of primaryContests) {
        if (entry.contest.provider === "codeforces.gym") {
          currentUserContestIds.add(entry.contest.id);
        }
      }
    }

    const friends = yield* userRepository.listByRole("friend").pipe(
      Effect.mapError(
        (error) =>
          new GymFinderError({
            code: "friend_roster_load_failed",
            message: error.message,
          }),
      ),
    );
    if (friends.length === 0) {
      return {
        rankings: [],
      } satisfies GymFinderResponse;
    }

    const contestToHandles = new Map<
      number,
      {
        readonly contest: typeof import("../db/schema.ts").contests.$inferSelect;
        readonly handles: Set<string>;
      }
    >();
    for (const friend of friends) {
      const gyms = yield* contestRepository.listQualifiedGymContestsForUser(friend.user.id).pipe(
        Effect.mapError(
          (error) =>
            new GymFinderError({
              code: "friend_gyms_load_failed",
              message: error.message,
            }),
        ),
      );

      for (const gym of gyms) {
        if (currentUserContestIds.has(gym.contest.id)) {
          continue;
        }

        const bucket = contestToHandles.get(gym.contest.id) ?? {
          contest: gym.contest,
          handles: new Set<string>(),
        };
        bucket.handles.add(friend.user.username);
        contestToHandles.set(gym.contest.id, bucket);
      }
    }

    const cachedCatalog = yield* cacheRepository
      .getJson<ReadonlyArray<CodeforcesContest>>(CACHE_KEYS.contestCatalogPayload)
      .pipe(
        Effect.mapError(
          (error) =>
            new GymFinderError({
              code: "contest_catalog_payload_load_failed",
              message: error.message,
            }),
        ),
      );
    const contestNames = new Map(
      (cachedCatalog ?? []).map((contest) => [String(contest.id), contest.name]),
    );

    const rankings = [...contestToHandles.values()]
      .map((entry) => {
        const handles = [...entry.handles].sort((left, right) => left.localeCompare(right));
        const title =
          contestNames.get(entry.contest.providerContestKey) ??
          entry.contest.title;
        return {
          contest: {
            id: entry.contest.id,
            provider: entry.contest.provider as "codeforces.gym" | "codeforces.contest",
            providerContestKey: entry.contest.providerContestKey,
            title,
            url: entry.contest.url,
            startsAt: entry.contest.startsAt,
            participantCount: entry.contest.participantCount,
          },
          friendCount: handles.length,
          coverage: Number((handles.length / friends.length).toFixed(4)),
          handles,
        };
      })
      .sort((left, right) => {
        if (right.friendCount !== left.friendCount) {
          return right.friendCount - left.friendCount;
        }
        if (right.coverage !== left.coverage) {
          return right.coverage - left.coverage;
        }
        const rightStartsAt = right.contest.startsAt ? Date.parse(right.contest.startsAt) : 0;
        const leftStartsAt = left.contest.startsAt ? Date.parse(left.contest.startsAt) : 0;
        if (rightStartsAt !== leftStartsAt) {
          return rightStartsAt - leftStartsAt;
        }
        return Number(right.contest.providerContestKey) - Number(left.contest.providerContestKey);
      })
      .slice(0, MAX_GYM_FINDER_RESULTS);

    return {
      rankings,
    } satisfies GymFinderResponse;
  });

  return GymFinderService.of({
    buildGymFinderRankings,
  });
});

export const GymFinderServiceLive = Layer.effect(
  GymFinderService,
  makeGymFinderService,
);
