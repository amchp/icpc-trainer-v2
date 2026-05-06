import { createHash, randomBytes } from "node:crypto";

import { Context, Effect, Layer } from "effect";

import { CodeforcesApiError } from "../errors/codeforces.ts";
import { normalizeHandleKey } from "../lib/handles.ts";

const CODEFORCES_API_BASE = "https://codeforces.com/api";
const OUTBOUND_INTERVAL_MS = 350;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PENDING_REQUESTS = 64;
const MAX_RETRY_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1_000;

type CodeforcesEnvelope<T> =
  | { status: "OK"; result: T }
  | { status: "FAILED"; comment: string };

export interface CodeforcesContest {
  readonly id: number;
  readonly name: string;
  readonly phase: string;
  readonly frozen: boolean;
  readonly durationSeconds: number;
  readonly startTimeSeconds?: number;
}

export interface CodeforcesUser {
  readonly handle: string;
  readonly rating?: number;
  readonly rank?: string;
}

export interface CodeforcesSubmission {
  readonly id: number;
  readonly contestId?: number;
  readonly creationTimeSeconds?: number;
  readonly verdict?: string;
  readonly problem: {
    readonly contestId?: number;
    readonly index: string;
    readonly name: string;
    readonly points?: number;
    readonly rating?: number;
    readonly tags?: ReadonlyArray<string>;
  };
}

export interface CodeforcesContestProblem {
  readonly contestId?: number;
  readonly index: string;
  readonly name: string;
  readonly points?: number;
  readonly rating?: number;
  readonly tags?: ReadonlyArray<string>;
}

export interface CodeforcesProblemStatistic {
  readonly contestId?: number;
  readonly index: string;
  readonly solvedCount: number;
}

export interface CodeforcesProblemsetPayload {
  readonly problems: ReadonlyArray<CodeforcesContestProblem>;
  readonly problemStatistics: ReadonlyArray<CodeforcesProblemStatistic>;
}

export interface CodeforcesProblemResult {
  readonly points?: number;
  readonly rejectedAttemptCount?: number;
  readonly bestSubmissionTimeSeconds?: number;
}

export interface CodeforcesParty {
  readonly members: ReadonlyArray<{
    readonly handle?: string;
    readonly name?: string;
  }>;
}

export interface CodeforcesStandingsRow {
  readonly party: CodeforcesParty;
  readonly rank: number;
  readonly points: number;
  readonly penalty: number;
  readonly problemResults: ReadonlyArray<CodeforcesProblemResult>;
}

export interface CodeforcesContestStandings {
  readonly contest: CodeforcesContest;
  readonly problems: ReadonlyArray<CodeforcesContestProblem>;
  readonly rows: ReadonlyArray<CodeforcesStandingsRow>;
}

type CacheEntry<T> = {
  readonly expiresAt: number;
  readonly value: T;
};

export interface CodeforcesClientShape {
  readonly getUserInfo: (
    handle: string,
  ) => Effect.Effect<CodeforcesUser | null, CodeforcesApiError>;
  readonly validateSignedCredentials: (
    apiKey: string,
    apiSecret: string,
  ) => Effect.Effect<void, CodeforcesApiError>;
  readonly getContestCatalog: () => Effect.Effect<Map<number, CodeforcesContest>, CodeforcesApiError>;
  readonly getGymContestCatalog: () => Effect.Effect<Map<number, CodeforcesContest>, CodeforcesApiError>;
  readonly getRegularContestCatalog: () => Effect.Effect<Map<number, CodeforcesContest>, CodeforcesApiError>;
  readonly getProblemsetProblems: () => Effect.Effect<CodeforcesProblemsetPayload, CodeforcesApiError>;
  readonly getUserStatusPage: (
    handle: string,
    from: number,
    count: number,
  ) => Effect.Effect<ReadonlyArray<CodeforcesSubmission>, CodeforcesApiError>;
  readonly getContestStandingsPage: (
    contestId: number,
    from: number,
    count: number,
    showUnofficial?: boolean,
  ) => Effect.Effect<CodeforcesContestStandings, CodeforcesApiError>;
  readonly getSignedContestStandingsPage: (
    contestId: number,
    from: number,
    count: number,
    showUnofficial: boolean,
    apiKey: string,
    apiSecret: string,
  ) => Effect.Effect<CodeforcesContestStandings, CodeforcesApiError>;
}

export class CodeforcesClient extends Context.Tag("icpc-trainer/CodeforcesClient")<
  CodeforcesClient,
  CodeforcesClientShape
>() {}

function buildSignedSearchParams(
  method: string,
  params: Record<string, string>,
  apiKey: string,
  apiSecret: string,
) {
  const time = Math.floor(Date.now() / 1_000).toString();
  const sortedEntries = Object.entries({
    ...params,
    apiKey,
    time,
  }).sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  );

  const query = new URLSearchParams(sortedEntries);
  const rand = randomBytes(3).toString("hex");
  const signaturePayload = `${rand}/${method}?${query.toString()}#${apiSecret}`;
  const digest = createHash("sha512").update(signaturePayload).digest("hex");
  query.set("apiSig", `${rand}${digest}`);

  return query;
}

function formatCodeforcesHttpError(url: string, status: number, body: string) {
  const parsedUrl = new URL(url);
  const method = parsedUrl.pathname.split("/").at(-1) ?? "unknown";
  const safeParams = [...parsedUrl.searchParams.entries()]
    .filter(([key]) => !["apiKey", "apiSig", "time"].includes(key))
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  let comment: string | null = null;
  try {
    const payload = JSON.parse(body) as { readonly comment?: unknown };
    if (typeof payload.comment === "string" && payload.comment.trim().length > 0) {
      comment = payload.comment.trim();
    }
  } catch {
    const trimmed = body.trim();
    if (trimmed.length > 0) {
      comment = trimmed.slice(0, 300);
    }
  }

  const parts = [`Codeforces ${method} returned HTTP ${status}.`];
  if (safeParams.length > 0) {
    parts.push(`Params: ${safeParams}.`);
  }
  if (comment) {
    parts.push(`Comment: ${comment}`);
  }
  return parts.join(" ");
}

class DefaultCodeforcesClient implements CodeforcesClientShape {
  private requestChain: Promise<void> = Promise.resolve();
  private pendingRequests = 0;
  private nextAvailableAt = 0;
  private contestCatalogCache: CacheEntry<Map<number, CodeforcesContest>> | null = null;
  private gymCatalogCache: CacheEntry<Map<number, CodeforcesContest>> | null = null;
  private regularCatalogCache: CacheEntry<Map<number, CodeforcesContest>> | null = null;
  private userCache = new Map<string, CacheEntry<CodeforcesUser | null>>();
  private problemsetCache: CacheEntry<CodeforcesProblemsetPayload> | null = null;

  getUserInfo(handle: string) {
    return Effect.tryPromise({
      try: async () => {
        const normalized = normalizeHandleKey(handle);
        const cached = this.userCache.get(normalized);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }

        const users = await this.request<ReadonlyArray<CodeforcesUser>>("user.info", {
          handles: handle,
          checkHistoricHandles: "true",
        });
        const user = users[0] ?? null;
        this.userCache.set(normalized, {
          expiresAt: Date.now() + DAY_MS,
          value: user,
        });
        return user;
      },
      catch: (error) => this.normalizeError(error, "user_info_failed"),
    });
  }

  validateSignedCredentials(apiKey: string, apiSecret: string) {
    return Effect.tryPromise({
      try: async () => {
        await this.requestSigned<ReadonlyArray<string>>(
          "user.friends",
          {
            onlyOnline: "false",
          },
          apiKey,
          apiSecret,
        );
      },
      catch: (error) => this.normalizeError(error, "signed_validation_failed"),
    });
  }

  getContestCatalog() {
    return Effect.tryPromise({
      try: async () => {
        const cached = this.contestCatalogCache;
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }

        const contests = await this.request<ReadonlyArray<CodeforcesContest>>("contest.list", {});
        const catalog = new Map<number, CodeforcesContest>();
        for (const contest of contests) {
          catalog.set(contest.id, contest);
        }
        this.contestCatalogCache = {
          expiresAt: Date.now() + DAY_MS,
          value: catalog,
        };
        return catalog;
      },
      catch: (error) => this.normalizeError(error, "contest_catalog_failed"),
    });
  }

  getGymContestCatalog() {
    return Effect.tryPromise({
      try: async () => {
        const cached = this.gymCatalogCache;
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }

        const contests = await this.request<ReadonlyArray<CodeforcesContest>>("contest.list", {
          gym: "true",
        });
        const catalog = new Map<number, CodeforcesContest>();
        for (const contest of contests) {
          catalog.set(contest.id, contest);
        }
        this.gymCatalogCache = {
          expiresAt: Date.now() + DAY_MS,
          value: catalog,
        };
        return catalog;
      },
      catch: (error) => this.normalizeError(error, "gym_catalog_failed"),
    });
  }

  getRegularContestCatalog() {
    return Effect.tryPromise({
      try: async () => {
        const cached = this.regularCatalogCache;
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }

        const contests = await this.request<ReadonlyArray<CodeforcesContest>>("contest.list", {
          gym: "false",
        });
        const catalog = new Map<number, CodeforcesContest>();
        for (const contest of contests) {
          catalog.set(contest.id, contest);
        }
        this.regularCatalogCache = {
          expiresAt: Date.now() + DAY_MS,
          value: catalog,
        };
        return catalog;
      },
      catch: (error) => this.normalizeError(error, "contest_catalog_failed"),
    });
  }

  getProblemsetProblems() {
    return Effect.tryPromise({
      try: async () => {
        const cached = this.problemsetCache;
        if (cached && cached.expiresAt > Date.now()) {
          return cached.value;
        }

        const payload = await this.request<CodeforcesProblemsetPayload>("problemset.problems", {});
        this.problemsetCache = {
          expiresAt: Date.now() + DAY_MS,
          value: payload,
        };
        return payload;
      },
      catch: (error) => this.normalizeError(error, "problemset_failed"),
    });
  }

  getUserStatusPage(handle: string, from: number, count: number) {
    return Effect.tryPromise({
      try: () =>
        this.request<ReadonlyArray<CodeforcesSubmission>>("user.status", {
          handle,
          from: String(from),
          count: String(count),
        }),
      catch: (error) => this.normalizeError(error, "user_status_failed"),
    });
  }

  getContestStandingsPage(contestId: number, from: number, count: number, showUnofficial = false) {
    return Effect.tryPromise({
      try: () =>
        this.request<CodeforcesContestStandings>("contest.standings", {
          contestId: String(contestId),
          from: String(from),
          count: String(count),
          showUnofficial: showUnofficial ? "true" : "false",
        }),
      catch: (error) => this.normalizeError(error, "contest_standings_failed"),
    });
  }

  getSignedContestStandingsPage(
    contestId: number,
    from: number,
    count: number,
    showUnofficial: boolean,
    apiKey: string,
    apiSecret: string,
  ) {
    return Effect.tryPromise({
      try: () =>
        this.requestSigned<CodeforcesContestStandings>(
          "contest.standings",
          {
            contestId: String(contestId),
            from: String(from),
            count: String(count),
            showUnofficial: showUnofficial ? "true" : "false",
          },
          apiKey,
          apiSecret,
        ),
      catch: (error) => this.normalizeError(error, "contest_standings_failed"),
    });
  }

  private request<T>(method: string, params: Record<string, string>) {
    return this.enqueueRequest<T>(`${CODEFORCES_API_BASE}/${method}?${new URLSearchParams(params)}`);
  }

  private requestSigned<T>(
    method: string,
    params: Record<string, string>,
    apiKey: string,
    apiSecret: string,
  ) {
    const query = buildSignedSearchParams(method, params, apiKey, apiSecret);
    return this.enqueueRequest<T>(`${CODEFORCES_API_BASE}/${method}?${query.toString()}`);
  }

  private async enqueueRequest<T>(url: string) {
    if (this.pendingRequests >= MAX_PENDING_REQUESTS) {
      throw new CodeforcesApiError({
        code: "queue_overflow",
        message: "Too many pending Codeforces requests.",
        statusCode: 429,
      });
    }

    this.pendingRequests += 1;

    const run = async () => {
      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
        const waitMs = Math.max(0, this.nextAvailableAt - Date.now());
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        this.nextAvailableAt = Date.now() + OUTBOUND_INTERVAL_MS;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            const body = await response.text();
            throw new CodeforcesApiError({
              code: "http_error",
              message: formatCodeforcesHttpError(url, response.status, body),
              statusCode: 502,
            });
          }

          const payload = (await response.json()) as CodeforcesEnvelope<T>;
          if (payload.status !== "OK") {
            throw new CodeforcesApiError({
              code: "api_failed",
              message: payload.comment,
              statusCode: 502,
            });
          }

          return payload.result;
        } catch (error) {
          const normalized = this.normalizeError(error, "request_failed");
          if (attempt + 1 < MAX_RETRY_ATTEMPTS && this.shouldRetry(normalized)) {
            this.nextAvailableAt = Math.max(
              this.nextAvailableAt,
              Date.now() + OUTBOUND_INTERVAL_MS * (attempt + 1),
            );
            continue;
          }

          throw normalized;
        } finally {
          clearTimeout(timeout);
        }
      }

      throw new CodeforcesApiError({
        code: "request_failed",
        message: "Codeforces request failed after retries.",
        statusCode: 502,
      });
    };

    const scheduled = this.requestChain.then(run, run);
    this.requestChain = scheduled.then(
      () => {
        this.pendingRequests -= 1;
      },
      () => {
        this.pendingRequests -= 1;
      },
    );
    return scheduled;
  }

  private shouldRetry(error: CodeforcesApiError) {
    const normalized = error.message.toLowerCase();
    return normalized.includes("call limit exceeded") || error.statusCode >= 500;
  }

  private normalizeError(error: unknown, code: string) {
    if (error instanceof CodeforcesApiError) {
      return error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      return new CodeforcesApiError({
        code,
        message: "Codeforces request timed out.",
        statusCode: 504,
      });
    }

    return new CodeforcesApiError({
      code,
      message: error instanceof Error ? error.message : "Unknown Codeforces request failure.",
      statusCode: 502,
    });
  }
}

export const makeCodeforcesClient = Effect.succeed(
  CodeforcesClient.of(new DefaultCodeforcesClient()),
);

export const CodeforcesClientLive = Layer.effect(CodeforcesClient, makeCodeforcesClient);
