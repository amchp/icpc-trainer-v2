import { Schema } from "effect";

export class RosterError extends Schema.TaggedError<RosterError>()(
  "RosterError",
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
