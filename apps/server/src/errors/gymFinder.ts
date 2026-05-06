import { Schema } from "effect";

export class GymFinderError extends Schema.TaggedError<GymFinderError>()(
  "GymFinderError",
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
