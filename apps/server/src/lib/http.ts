import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect, ParseResult, Schema } from "effect";

export function formatParseError(error: ParseResult.ParseError) {
  return ParseResult.TreeFormatter.formatErrorSync(error);
}

export function decodeJsonBody<A, I, R, E>(
  schema: Schema.Schema<A, I, R>,
  onError: (message: string) => E,
) {
  return Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const payload = yield* request.json;
    return yield* Schema.decodeUnknown(schema)(payload).pipe(
      Effect.mapError((error) => onError(formatParseError(error))),
    );
  });
}

export function decodePathParams<A, I extends Readonly<Record<string, string | undefined>>, R, E>(
  schema: Schema.Schema<A, I, R>,
  onError: (message: string) => E,
) {
  return HttpRouter.params.pipe(
    Effect.flatMap((params) =>
      Schema.decodeUnknown(schema)(params).pipe(
        Effect.mapError((error) => onError(formatParseError(error))),
      ),
    ),
  );
}

export function decodeSearchParams<
  A,
  I extends Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
  R,
  E,
>(schema: Schema.Schema<A, I, R>, onError: (message: string) => E) {
  return Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(request.url, "http://localhost");
    const searchParams = Object.fromEntries(url.searchParams.entries());
    return yield* Schema.decodeUnknown(schema)(searchParams).pipe(
      Effect.mapError((error) => onError(formatParseError(error))),
    );
  });
}

export function schemaJson<A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  options?: { readonly status?: number },
) {
  return HttpServerResponse.schemaJson(schema)(value, {
    status: options?.status,
  });
}

export function errorJson(status: number, tag: string, message: string) {
  return HttpServerResponse.unsafeJson(
    {
      error: {
        tag,
        message,
      },
    },
    { status },
  );
}
