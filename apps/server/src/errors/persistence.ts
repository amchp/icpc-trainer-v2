import { Schema } from "effect";

export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
