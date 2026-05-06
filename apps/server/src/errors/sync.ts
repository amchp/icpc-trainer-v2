import { Schema } from "effect";

export class SyncError extends Schema.TaggedError<SyncError>()(
  "SyncError",
  {
    code: Schema.String,
    message: Schema.String,
  },
) {}
