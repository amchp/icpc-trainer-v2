import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ReplaceRosterRequest } from "./roster.ts";
import { LoginRequest } from "./session.ts";

describe("contracts", () => {
  it("decodes valid session login payloads", () => {
    const value = Schema.decodeUnknownSync(LoginRequest)({
      handle: "tourist",
      apiKey: "abc",
      apiSecret: "def",
    });

    expect(value).toEqual({
      handle: "tourist",
      apiKey: "abc",
      apiSecret: "def",
    });
  });

  it("rejects invalid roster payloads", () => {
    expect(() =>
      Schema.decodeUnknownSync(ReplaceRosterRequest)({
        handles: ["bad handle"],
      }),
    ).toThrowError();
  });
});
