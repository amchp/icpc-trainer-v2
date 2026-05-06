import { Schema } from "effect";

export class SessionError extends Schema.TaggedError<SessionError>()(
  "SessionError",
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
