import { Schema } from "effect";

export class CodeforcesApiError extends Schema.TaggedError<CodeforcesApiError>()(
  "CodeforcesApiError",
  {
    code: Schema.String,
    message: Schema.String,
    statusCode: Schema.Int,
  },
) {}
