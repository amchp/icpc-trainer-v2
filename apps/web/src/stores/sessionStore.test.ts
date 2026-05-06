import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionApi = vi.hoisted(() => ({
  getSession: vi.fn(),
  loginSession: vi.fn(),
  logoutSession: vi.fn(),
}));

vi.mock("../lib/api/session", () => sessionApi);

import { sessionStore } from "./sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    sessionStore.reset();
    sessionApi.getSession.mockReset();
    sessionApi.loginSession.mockReset();
    sessionApi.logoutSession.mockReset();
  });

  it("bootstraps into an authenticated state", async () => {
    sessionApi.getSession.mockResolvedValue({
      startupSyncReady: true,
      session: {
        currentUser: {
          id: 1,
          provider: "codeforces",
          providerUserKey: "tourist",
          username: "tourist",
          lastProgressSyncedAt: null,
        },
        currentHandle: "tourist",
        authenticatedAt: "2026-05-05T00:00:00.000Z",
        lastValidatedAt: "2026-05-05T00:00:00.000Z",
      },
    });

    await sessionStore.bootstrap();

    expect(sessionStore.getState()).toMatchObject({
      status: "authenticated",
      currentHandle: "tourist",
      startupSyncReady: true,
    });
  });

  it("stores login failures near the form state", async () => {
    sessionApi.loginSession.mockRejectedValue(new Error("Bad signature."));

    const result = await sessionStore.login({
      handle: "tourist",
      apiKey: "key",
      apiSecret: "secret",
    });

    expect(result).toEqual({ ok: false, error: "Bad signature." });
    expect(sessionStore.getState()).toMatchObject({
      status: "anonymous",
      loginError: "Bad signature.",
    });
  });

  it("logs out to the anonymous shell even if the backend call fails", async () => {
    sessionStore.__setStateForTests({
      status: "authenticated",
      currentHandle: "tourist",
      authenticatedAt: "2026-05-05T00:00:00.000Z",
    });
    sessionApi.logoutSession.mockRejectedValue(new Error("network down"));

    await sessionStore.logout();

    expect(sessionStore.getState()).toMatchObject({
      status: "anonymous",
      currentHandle: null,
    });
  });
});
