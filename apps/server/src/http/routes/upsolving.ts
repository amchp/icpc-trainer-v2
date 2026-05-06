import { HttpRouter, HttpServerResponse } from "@effect/platform";
import { Effect, Schema, Stream } from "effect";

import {
  CompleteUpsolvingProblemResponse,
  CompleteUpsolvingProblemsResponse,
  SyncUpsolvingResponse,
  UpsolvingContestDetailResponse,
  UpsolvingOverviewResponse,
} from "../../contracts/upsolving.ts";
import { UpsolvingError } from "../../errors/upsolving.ts";
import { decodeJsonBody, decodePathParams, errorJson, schemaJson } from "../../lib/http.ts";
import { UpsolvingEventService } from "../../services/upsolvingEvents.ts";
import { UpsolvingService } from "../../services/upsolving.ts";

const SyncUpsolvingRequest = Schema.Struct({
  force: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

const ContestIdParams = Schema.Struct({
  contestId: Schema.NumberFromString,
});

const ProblemIdParams = Schema.Struct({
  problemId: Schema.NumberFromString,
});

const CompleteUpsolvingProblemsRequest = Schema.Struct({
  problemIds: Schema.Array(Schema.Int),
});

const textEncoder = new TextEncoder();

function encodeServerSentEvent(event: unknown) {
  return textEncoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function upsolvingStatus(error: UpsolvingError) {
  switch (error.code) {
    case "missing_session":
      return 401;
    case "contest_not_found":
    case "problem_not_found":
      return 404;
    default:
      return 500;
  }
}

export const upsolvingRoutes = HttpRouter.empty.pipe(
  HttpRouter.post(
    "/api/upsolving/problems/complete",
    Effect.gen(function* () {
      const upsolvingService = yield* UpsolvingService;
      const payload = yield* decodeJsonBody(
        CompleteUpsolvingProblemsRequest,
        (message) =>
          new UpsolvingError({
            code: "invalid_request",
            message,
          }),
      );
      return yield* schemaJson(
        CompleteUpsolvingProblemsResponse,
        yield* upsolvingService.completeProblems(payload.problemIds),
      );
    }).pipe(
      Effect.catchTag("UpsolvingError", (error) =>
        Effect.succeed(errorJson(upsolvingStatus(error), error.code, error.message)),
      ),
    ),
  ),
  HttpRouter.post(
    "/api/upsolving/problems/:problemId/complete",
    Effect.gen(function* () {
      const upsolvingService = yield* UpsolvingService;
      const { problemId } = yield* decodePathParams(
        ProblemIdParams,
        (message) =>
          new UpsolvingError({
            code: "invalid_request",
            message,
          }),
      );
      return yield* schemaJson(
        CompleteUpsolvingProblemResponse,
        yield* upsolvingService.completeProblem(problemId),
      );
    }).pipe(
      Effect.catchTag("UpsolvingError", (error) =>
        Effect.succeed(errorJson(upsolvingStatus(error), error.code, error.message)),
      ),
    ),
  ),
  HttpRouter.post(
    "/api/upsolving/sync",
    Effect.gen(function* () {
      const upsolvingService = yield* UpsolvingService;
      const payload = yield* decodeJsonBody(
        SyncUpsolvingRequest,
        (message) =>
          new UpsolvingError({
            code: "invalid_request",
            message,
          }),
      );
      return yield* schemaJson(
        SyncUpsolvingResponse,
        yield* upsolvingService.syncCurrentContext(payload.force),
      );
    }).pipe(
      Effect.catchTag("UpsolvingError", (error) =>
        Effect.succeed(errorJson(upsolvingStatus(error), error.code, error.message)),
      ),
    ),
  ),
  HttpRouter.get(
    "/api/upsolving/events",
    Effect.gen(function* () {
      const upsolvingEvents = yield* UpsolvingEventService;
      return HttpServerResponse.stream(
        upsolvingEvents.subscribe().pipe(Stream.map(encodeServerSentEvent)),
        {
          headers: {
            "cache-control": "no-cache",
            connection: "keep-alive",
            "content-type": "text/event-stream",
            "x-accel-buffering": "no",
          },
        },
      );
    }),
  ),
  HttpRouter.get(
    "/api/upsolving",
    Effect.gen(function* () {
      const upsolvingService = yield* UpsolvingService;
      return yield* schemaJson(
        UpsolvingOverviewResponse,
        yield* upsolvingService.buildUpsolvingView(),
      );
    }).pipe(
      Effect.catchTag("UpsolvingError", (error) =>
        Effect.succeed(errorJson(upsolvingStatus(error), error.code, error.message)),
      ),
    ),
  ),
  HttpRouter.get(
    "/api/upsolving/:contestId",
    Effect.gen(function* () {
      const upsolvingService = yield* UpsolvingService;
      const { contestId } = yield* decodePathParams(
        ContestIdParams,
        (message) =>
          new UpsolvingError({
            code: "invalid_request",
            message,
          }),
      );
      return yield* schemaJson(
        UpsolvingContestDetailResponse,
        yield* upsolvingService.buildContestView(contestId),
      );
    }).pipe(
      Effect.catchTag("UpsolvingError", (error) =>
        Effect.succeed(errorJson(upsolvingStatus(error), error.code, error.message)),
      ),
    ),
  ),
);
