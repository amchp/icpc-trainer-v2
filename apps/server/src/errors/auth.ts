import { Schema } from "effect";

export class AuthError extends Schema.TaggedError<AuthError>()(
  "AuthError",
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
