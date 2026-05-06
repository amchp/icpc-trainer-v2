import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import type {
  CodeforcesClientShape,
  CodeforcesContest,
  CodeforcesContestStandings,
  CodeforcesProblemsetPayload,
  CodeforcesSubmission,
  CodeforcesUser,
} from "./codeforcesClient.ts";
import { SessionService } from "./session.ts";
import { CatalogSyncService } from "./catalogSync.ts";
import { StartupSyncService } from "./startupSync.ts";
import { UserRepository } from "../repos/users.ts";
import { ContestRepository } from "../repos/contests.ts";
import { RosterService } from "./roster.ts";
import { UpsolvingService } from "./upsolving.ts";
import { GymFinderService } from "./gymFinder.ts";
import { HandleSyncService } from "./handleSync.ts";
import { makeTestApplicationLayer } from "../testSupport.ts";

function makeFakeCodeforcesClient(state?: {
  readonly submissionsByHandle?: Record<string, ReadonlyArray<CodeforcesSubmission>>;
  readonly standingsByContestId?: Record<number, CodeforcesContestStandings>;
  readonly callCounter?: { statusCalls: number; standingsCalls?: number };
}): CodeforcesClientShape {
  const users: Record<string, CodeforcesUser> = {
    tourist: { handle: "tourist" },
    benq: { handle: "Benq" },
    ally: { handle: "ally" },
  };

  const gymCatalog = new Map<number, CodeforcesContest>([
    [
      1001,
      {
        id: 1001,
        name: "Gym 1001",
        phase: "FINISHED",
        frozen: false,
        durationSeconds: 7200,
        startTimeSeconds: 1_700_000_000,
      },
    ],
    [
      100001,
      {
        id: 100001,
        name: "Named Gym 100001",
        phase: "FINISHED",
        frozen: false,
        durationSeconds: 7200,
        startTimeSeconds: 1_700_000_000,
      },
    ],
  ]);

  const problemset: CodeforcesProblemsetPayload = {
    problems: [],
    problemStatistics: [],
  };

  const standings: CodeforcesContestStandings = {
    contest: {
      id: 1001,
      name: "Gym 1001",
      phase: "FINISHED",
      frozen: false,
      durationSeconds: 7200,
      startTimeSeconds: 1_700_000_000,
    },
    problems: [],
    rows: [],
  };

  return {
    getUserInfo: (handle) =>
      Effect.succeed(users[handle.trim().toLowerCase()] ?? null),
    validateSignedCredentials: () => Effect.void,
    getContestCatalog: () => Effect.succeed(gymCatalog),
    getGymContestCatalog: () => Effect.succeed(gymCatalog),
    getRegularContestCatalog: () => Effect.succeed(new Map()),
    getProblemsetProblems: () => Effect.succeed(problemset),
    getUserStatusPage: (handle, from, count) => {
      if (state?.callCounter) {
        state.callCounter.statusCalls += 1;
      }
      const submissions = state?.submissionsByHandle?.[handle.trim().toLowerCase()] ?? [];
      return Effect.succeed(submissions.slice(from - 1, from - 1 + count));
    },
    getContestStandingsPage: (contestId) =>
      Effect.succeed(state?.standingsByContestId?.[contestId] ?? standings),
    getSignedContestStandingsPage: (contestId) => {
      if (state?.callCounter) {
        state.callCounter.standingsCalls = (state.callCounter.standingsCalls ?? 0) + 1;
      }
      return Effect.succeed(state?.standingsByContestId?.[contestId] ?? standings);
    },
  };
}

describe("services", () => {
  it("login persists the session and primary role", async () => {
    const counter = { statusCalls: 0 };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        callCounter: counter,
        submissionsByHandle: {
          tourist: [
            {
              id: 1,
              problem: {
                contestId: 1001,
                index: "A",
                name: "Warmup",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_100,
            },
          ],
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const userRepository = yield* UserRepository;
      const session = yield* sessionService.login({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      });
      const primaryUsers = yield* userRepository.listByRole("primary");
      return {
        session,
        primaryUsers,
        statusCalls: counter.statusCalls,
      };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.session.currentHandle).toBe("tourist");
    expect(result.primaryUsers.map((entry) => entry.user.username)).toEqual(["tourist"]);
    expect(result.statusCalls).toBe(0);
  });

  it("allows the same user to be both friend and teammate", async () => {
    const layer = makeTestApplicationLayer(makeFakeCodeforcesClient());

    const result = await Effect.gen(function* () {
      const rosterService = yield* RosterService;
      yield* rosterService.replaceRoster("friend", ["Benq"]);
      yield* rosterService.replaceRoster("teammate", ["Benq"]);
      return {
        friends: yield* rosterService.getRoster("friend"),
        team: yield* rosterService.getRoster("teammate"),
      };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.friends.handles).toEqual(["Benq"]);
    expect(result.team.handles).toEqual(["Benq"]);
  });

  it("skips roster handle syncing when cached progress is fresh", async () => {
    const counter = { statusCalls: 0 };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        callCounter: counter,
        submissionsByHandle: {
          benq: [
            {
              id: 1,
              problem: {
                contestId: 1001,
                index: "A",
                name: "Warmup",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_100,
            },
          ],
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const rosterService = yield* RosterService;
      yield* rosterService.replaceRoster("friend", ["Benq"]);
      const firstSync = yield* rosterService.syncRoster("friend", false);
      const secondSync = yield* rosterService.syncRoster("friend", false);
      return {
        firstSync,
        secondSync,
        statusCalls: counter.statusCalls,
      };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.firstSync.syncedHandles).toEqual(["Benq"]);
    expect(result.secondSync.syncedHandles).toEqual([]);
    expect(result.statusCalls).toBe(1);
  });

  it("stores only gym submissions during handle sync", async () => {
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        submissionsByHandle: {
          benq: [
            {
              id: 1,
              problem: {
                contestId: 1001,
                index: "A",
                name: "Regular Warmup",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_100,
            },
            {
              id: 2,
              problem: {
                contestId: 1001,
                index: "B",
                name: "Regular Followup",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_150,
            },
            {
              id: 3,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Gym Warmup",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 4,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Gym Followup",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_250,
            },
          ],
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const rosterService = yield* RosterService;
      const catalogSyncService = yield* CatalogSyncService;
      const contestRepository = yield* ContestRepository;
      yield* catalogSyncService.syncCatalogsIfStale(false);
      yield* rosterService.replaceRoster("friend", ["Benq"]);
      yield* rosterService.syncRoster("friend", false);
      const friends = yield* rosterService.getRoster("friend");
      const friend = friends.entries[0];
      return friend ? yield* contestRepository.listQualifiedGymContestsForUser(friend.user.id) : [];
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.map((entry) => entry.contest.providerContestKey)).toEqual(["100001"]);
    expect(result.map((entry) => entry.contest.title)).toEqual(["Named Gym 100001"]);
  });

  it("hydrates gym problems from contest standings even when submission placeholders exist", async () => {
    const counter = { statusCalls: 0, standingsCalls: 0 };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        callCounter: counter,
        submissionsByHandle: {
          tourist: [
            {
              id: 10,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Placeholder A",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 11,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Placeholder B",
              },
              verdict: "WRONG_ANSWER",
              creationTimeSeconds: 1_700_000_260,
            },
          ],
        },
        standingsByContestId: {
          100001: {
            contest: {
              id: 100001,
              name: "Named Gym 100001",
              phase: "FINISHED",
              frozen: false,
              durationSeconds: 7200,
              startTimeSeconds: 1_700_000_000,
            },
            problems: [
              { contestId: 100001, index: "A", name: "Standing A" },
              { contestId: 100001, index: "B", name: "Standing B" },
              { contestId: 100001, index: "C", name: "Standing C" },
            ],
            rows: [
              {
                party: { members: [{ handle: "tourist" }] },
                rank: 1,
                points: 1,
                penalty: 10,
                problemResults: [
                  { points: 1, bestSubmissionTimeSeconds: 100 },
                  { rejectedAttemptCount: 2 },
                  {},
                ],
              },
              {
                party: { members: [{ handle: "Benq" }] },
                rank: 2,
                points: 2,
                penalty: 30,
                problemResults: [
                  { points: 1, rejectedAttemptCount: 1, bestSubmissionTimeSeconds: 120 },
                  { points: 1, bestSubmissionTimeSeconds: 220 },
                  {},
                ],
              },
              {
                party: { members: [{ handle: "other" }] },
                rank: 3,
                points: 0,
                penalty: 0,
                problemResults: [{}, {}, { rejectedAttemptCount: 1 }],
              },
            ],
          },
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const startupSyncService = yield* StartupSyncService;
      const upsolvingService = yield* UpsolvingService;
      yield* sessionService.login({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      });
      yield* startupSyncService.runStartupSync();
      yield* upsolvingService.syncCurrentContext(true);
      return yield* upsolvingService.buildUpsolvingView();
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(counter.standingsCalls).toBe(1);
    expect(result.progress.readyGymCount).toBe(1);
    expect(result.progress.pendingGymCount).toBe(0);
    expect(result.gyms[0]?.contest.participantCount).toBe(2);
    expect(result.gyms[0]?.problems.map((problem) => problem.title)).toEqual([
      "Standing A",
      "Standing B",
      "Standing C",
    ]);
    expect(result.gyms[0]?.problems.map((problem) => ({
      index: problem.providerProblemKey,
      solverCount: problem.solverCount,
      attemptCount: problem.attemptCount,
      submissionCount: problem.submissionCount,
      solveRate: problem.solveRate,
    }))).toEqual([
      { index: "A", solverCount: null, attemptCount: 2, submissionCount: 2, solveRate: 1 },
      { index: "B", solverCount: null, attemptCount: 2, submissionCount: 2, solveRate: 1 },
      { index: "C", solverCount: null, attemptCount: 2, submissionCount: 1, solveRate: 0.5 },
    ]);
  });

  it("does not reset ready gym standing snapshots during forced handle sync", async () => {
    const counter = { statusCalls: 0, standingsCalls: 0 };
    const standingsSnapshot: CodeforcesContestStandings = {
      contest: {
        id: 100001,
        name: "Named Gym 100001",
        phase: "FINISHED",
        frozen: false,
        durationSeconds: 7200,
        startTimeSeconds: 1_700_000_000,
      },
      problems: [
        { contestId: 100001, index: "A", name: "Standing A" },
        { contestId: 100001, index: "B", name: "Standing B" },
      ],
      rows: [
        {
          party: { members: [{ handle: "tourist" }] },
          rank: 1,
          points: 1,
          penalty: 10,
          problemResults: [{ points: 1, bestSubmissionTimeSeconds: 100 }, { rejectedAttemptCount: 1 }],
        },
      ],
    };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        callCounter: counter,
        submissionsByHandle: {
          tourist: [
            {
              id: 20,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Placeholder A",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 21,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Placeholder B",
              },
              verdict: "WRONG_ANSWER",
              creationTimeSeconds: 1_700_000_260,
            },
          ],
        },
        standingsByContestId: {
          100001: standingsSnapshot,
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const startupSyncService = yield* StartupSyncService;
      const upsolvingService = yield* UpsolvingService;
      yield* sessionService.login({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      });
      yield* startupSyncService.runStartupSync();
      yield* upsolvingService.syncCurrentContext(true);
      const firstView = yield* upsolvingService.buildUpsolvingView();
      yield* startupSyncService.runStartupSync();
      yield* upsolvingService.syncCurrentContext(true);
      const secondView = yield* upsolvingService.buildUpsolvingView();
      return { firstView, secondView };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(counter.standingsCalls).toBe(1);
    expect(result.firstView.progress.pendingGymCount).toBe(0);
    expect(result.secondView.progress.pendingGymCount).toBe(0);
    expect(result.secondView.gyms[0]?.contest.participantCount).toBe(1);
    expect(result.secondView.gyms[0]?.problems.map((problem) => problem.title)).toEqual([
      "Standing A",
      "Standing B",
    ]);
  });

  it("treats teammates as part of the primary training group", async () => {
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        submissionsByHandle: {
          benq: [
            {
              id: 30,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Team A",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 31,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Team B",
              },
              verdict: "WRONG_ANSWER",
              creationTimeSeconds: 1_700_000_260,
            },
          ],
          ally: [
            {
              id: 40,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Friend A",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 41,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Friend B",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_260,
            },
          ],
        },
        standingsByContestId: {
          100001: {
            contest: {
              id: 100001,
              name: "Named Gym 100001",
              phase: "FINISHED",
              frozen: false,
              durationSeconds: 7200,
              startTimeSeconds: 1_700_000_000,
            },
            problems: [
              { contestId: 100001, index: "A", name: "Standing A" },
              { contestId: 100001, index: "B", name: "Standing B" },
            ],
            rows: [
              {
                party: { members: [{ handle: "Benq" }] },
                rank: 1,
                points: 1,
                penalty: 10,
                problemResults: [
                  { points: 1, bestSubmissionTimeSeconds: 100 },
                  { rejectedAttemptCount: 1 },
                ],
              },
            ],
          },
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const rosterService = yield* RosterService;
      const upsolvingService = yield* UpsolvingService;
      const gymFinderService = yield* GymFinderService;
      yield* sessionService.login({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      });
      yield* rosterService.replaceRoster("teammate", ["Benq"]);
      yield* rosterService.replaceRoster("friend", ["ally"]);
      yield* rosterService.syncRoster("friend", true);
      yield* upsolvingService.syncCurrentContext(true);
      return {
        upsolving: yield* upsolvingService.buildUpsolvingView(),
        gymFinder: yield* gymFinderService.buildGymFinderRankings(),
      };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.upsolving.gyms.map((entry) => entry.contest.providerContestKey)).toEqual([
      "100001",
    ]);
    expect(result.upsolving.gyms[0]?.problems.map((problem) => ({
      index: problem.providerProblemKey,
      attempted: problem.attempted,
      passed: problem.passed,
    }))).toEqual([
      { index: "A", attempted: true, passed: true },
      { index: "B", attempted: true, passed: false },
    ]);
    expect(result.gymFinder.rankings).toEqual([]);
  });

  it("updates ready gym state from accepted teammate submissions without resnapshotting", async () => {
    const counter = { statusCalls: 0, standingsCalls: 0 };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        callCounter: counter,
        submissionsByHandle: {
          tourist: [
            {
              id: 50,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Current A",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 51,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Current B",
              },
              verdict: "WRONG_ANSWER",
              creationTimeSeconds: 1_700_000_260,
            },
          ],
          benq: [
            {
              id: 52,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Current B",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_300,
            },
          ],
        },
        standingsByContestId: {
          100001: {
            contest: {
              id: 100001,
              name: "Named Gym 100001",
              phase: "FINISHED",
              frozen: false,
              durationSeconds: 7200,
              startTimeSeconds: 1_700_000_000,
            },
            problems: [
              { contestId: 100001, index: "A", name: "Standing A" },
              { contestId: 100001, index: "B", name: "Standing B" },
            ],
            rows: [
              {
                party: { members: [{ handle: "tourist" }] },
                rank: 1,
                points: 1,
                penalty: 10,
                problemResults: [
                  { points: 1, bestSubmissionTimeSeconds: 100 },
                  { rejectedAttemptCount: 1 },
                ],
              },
              {
                party: { members: [{ handle: "Benq" }] },
                rank: 2,
                points: 1,
                penalty: 20,
                problemResults: [
                  {},
                  { points: 1, bestSubmissionTimeSeconds: 120 },
                ],
              },
            ],
          },
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const startupSyncService = yield* StartupSyncService;
      const rosterService = yield* RosterService;
      const upsolvingService = yield* UpsolvingService;
      yield* sessionService.login({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      });
      yield* startupSyncService.runStartupSync();
      yield* upsolvingService.syncCurrentContext(true);
      const beforeTeam = yield* upsolvingService.buildUpsolvingView();
      yield* rosterService.replaceRoster("teammate", ["Benq"]);
      yield* startupSyncService.runStartupSync();
      yield* upsolvingService.syncCurrentContext(true);
      const afterTeam = yield* upsolvingService.buildUpsolvingView();
      return { beforeTeam, afterTeam };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(counter.standingsCalls).toBe(1);
    expect(result.beforeTeam.gyms[0]?.problems.find((problem) => problem.providerProblemKey === "B")?.passed).toBe(false);
    expect(result.afterTeam.gyms[0]?.problems.find((problem) => problem.providerProblemKey === "B")?.passed).toBe(true);
  });

  it("keeps manually completed problems solved after later handle syncs", async () => {
    const codeforcesState = {
      submissionsByHandle: {
        tourist: [
          {
            id: 80,
            problem: {
              contestId: 100001,
              index: "A",
              name: "Current A",
            },
            verdict: "OK",
            creationTimeSeconds: 1_700_000_200,
          },
          {
            id: 79,
            problem: {
              contestId: 100001,
              index: "B",
              name: "Current B",
            },
            verdict: "WRONG_ANSWER",
            creationTimeSeconds: 1_700_000_260,
          },
        ] satisfies CodeforcesSubmission[],
      },
    };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        submissionsByHandle: codeforcesState.submissionsByHandle,
        standingsByContestId: {
          100001: {
            contest: {
              id: 100001,
              name: "Named Gym 100001",
              phase: "FINISHED",
              frozen: false,
              durationSeconds: 7200,
              startTimeSeconds: 1_700_000_000,
            },
            problems: [
              { contestId: 100001, index: "A", name: "Standing A" },
              { contestId: 100001, index: "B", name: "Standing B" },
            ],
            rows: [
              {
                party: { members: [{ handle: "tourist" }] },
                rank: 1,
                points: 1,
                penalty: 10,
                problemResults: [
                  { points: 1, bestSubmissionTimeSeconds: 100 },
                  { rejectedAttemptCount: 1 },
                ],
              },
            ],
          },
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const startupSyncService = yield* StartupSyncService;
      const upsolvingService = yield* UpsolvingService;
      const handleSyncService = yield* HandleSyncService;
      yield* sessionService.login({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      });
      yield* startupSyncService.runStartupSync();
      yield* upsolvingService.syncCurrentContext(true);
      const beforeComplete = yield* upsolvingService.buildUpsolvingView();
      const problemB = beforeComplete.gyms[0]?.problems.find(
        (problem) => problem.providerProblemKey === "B",
      );
      if (!problemB) {
        throw new Error("Expected problem B in the upsolving view.");
      }
      yield* upsolvingService.completeProblem(problemB.id);
      yield* handleSyncService.syncHandle("tourist", true);
      const afterResync = yield* upsolvingService.buildUpsolvingView();
      return {
        beforeComplete,
        afterResync,
      };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.beforeComplete.gyms[0]?.problems.find((problem) => problem.providerProblemKey === "B")?.passed).toBe(false);
    expect(result.afterResync.gyms[0]?.problems.find((problem) => problem.providerProblemKey === "B")?.passed).toBe(true);
  });

  it("fetches user submissions until the first repeated submission", async () => {
    const counter = { statusCalls: 0 };
    const firstSubmissions = Array.from({ length: 150 }, (_, index) => {
      const id = 150 - index;
      return {
        id,
        problem: {
          contestId: 100001,
          index: String.fromCharCode(65 + (index % 26)),
          name: `Problem ${id}`,
        },
        verdict: index % 2 === 0 ? "OK" : "WRONG_ANSWER",
        creationTimeSeconds: 1_700_000_000 + id,
      } satisfies CodeforcesSubmission;
    });
    const codeforcesState = {
      submissionsByHandle: {
        benq: firstSubmissions,
      },
    };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        callCounter: counter,
        submissionsByHandle: codeforcesState.submissionsByHandle,
      }),
    );

    const result = await Effect.gen(function* () {
      const handleSyncService = yield* HandleSyncService;
      yield* handleSyncService.syncHandle("Benq", true);
      const firstCallCount = counter.statusCalls;
      codeforcesState.submissionsByHandle.benq = [
        {
          id: 152,
          problem: {
            contestId: 100001,
            index: "AA",
            name: "New A",
          },
          verdict: "OK",
          creationTimeSeconds: 1_700_000_300,
        },
        {
          id: 151,
          problem: {
            contestId: 100001,
            index: "AB",
            name: "New B",
          },
          verdict: "OK",
          creationTimeSeconds: 1_700_000_301,
        },
        ...firstSubmissions,
      ];
      yield* handleSyncService.syncHandle("Benq", true);
      return {
        firstCallCount,
        totalCallCount: counter.statusCalls,
      };
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.firstCallCount).toBe(1);
    expect(result.totalCallCount).toBe(2);
  });

  it("excludes gyms from finder when a teammate has two submissions there", async () => {
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        submissionsByHandle: {
          benq: [
            {
              id: 60,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Team A",
              },
              verdict: "WRONG_ANSWER",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 61,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Team B",
              },
              verdict: "WRONG_ANSWER",
              creationTimeSeconds: 1_700_000_260,
            },
          ],
          ally: [
            {
              id: 70,
              problem: {
                contestId: 100001,
                index: "A",
                name: "Friend A",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_200,
            },
            {
              id: 71,
              problem: {
                contestId: 100001,
                index: "B",
                name: "Friend B",
              },
              verdict: "OK",
              creationTimeSeconds: 1_700_000_260,
            },
          ],
        },
      }),
    );

    const result = await Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const rosterService = yield* RosterService;
      const upsolvingService = yield* UpsolvingService;
      const gymFinderService = yield* GymFinderService;
      yield* sessionService.login({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      });
      yield* rosterService.replaceRoster("teammate", ["Benq"]);
      yield* rosterService.replaceRoster("friend", ["ally"]);
      yield* rosterService.syncRoster("friend", true);
      yield* upsolvingService.syncCurrentContext(true);
      return yield* gymFinderService.buildGymFinderRankings();
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(result.rankings).toEqual([]);
  });

  it("startup sync skips handle syncing when there is no session", async () => {
    const counter = { statusCalls: 0 };
    const layer = makeTestApplicationLayer(
      makeFakeCodeforcesClient({
        callCounter: counter,
      }),
    );

    await Effect.gen(function* () {
      const startupSyncService = yield* StartupSyncService;
      yield* startupSyncService.runStartupSync();
    }).pipe(Effect.provide(layer), Effect.runPromise);

    expect(counter.statusCalls).toBe(0);
  });
});
