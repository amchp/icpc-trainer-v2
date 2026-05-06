import { Schema } from "effect";

export class UpsolvingError extends Schema.TaggedError<UpsolvingError>()(
  "UpsolvingError",
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
