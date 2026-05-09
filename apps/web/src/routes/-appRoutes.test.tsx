import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionApi = vi.hoisted(() => ({
  getSession: vi.fn(),
  loginSession: vi.fn(),
  logoutSession: vi.fn(),
}));

const friendsApi = vi.hoisted(() => ({
  getFriends: vi.fn(),
  replaceFriends: vi.fn(),
  syncFriends: vi.fn(),
}));

const teamApi = vi.hoisted(() => ({
  getTeam: vi.fn(),
  replaceTeam: vi.fn(),
  syncTeam: vi.fn(),
}));

const gymFinderApi = vi.hoisted(() => ({
  getGymFinderResults: vi.fn(),
}));

const upsolvingApi = vi.hoisted(() => ({
  getUpsolving: vi.fn(),
  syncUpsolving: vi.fn(),
}));

const browserApi = vi.hoisted(() => ({
  reloadPage: vi.fn(),
}));

vi.mock("../lib/api/session", () => sessionApi);
vi.mock("../lib/api/friends", () => friendsApi);
vi.mock("../lib/api/team", () => teamApi);
vi.mock("../lib/api/gymFinder", () => gymFinderApi);
vi.mock("../lib/api/upsolving", () => upsolvingApi);
vi.mock("../lib/browser", () => browserApi);

import { getTestRouter } from "../router";
import { ApiError } from "../lib/api/errors";
import { sessionStore } from "../stores/sessionStore";
import { uiStore } from "../stores/uiStore";

function authenticatedSession() {
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
}

async function renderRoute(path: string) {
  const router = getTestRouter(path);
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(screen.queryByTestId("app-shell")).not.toBeNull());
}

describe("app routes", () => {
  beforeEach(() => {
    sessionStore.reset();
    uiStore.reset();
    sessionApi.getSession.mockReset();
    friendsApi.getFriends.mockReset();
    friendsApi.replaceFriends.mockReset();
    friendsApi.syncFriends.mockReset();
    teamApi.getTeam.mockReset();
    teamApi.replaceTeam.mockReset();
    teamApi.syncTeam.mockReset();
    browserApi.reloadPage.mockReset();
    gymFinderApi.getGymFinderResults.mockReset();
    upsolvingApi.getUpsolving.mockReset();
    upsolvingApi.syncUpsolving.mockReset();
  });

  it("renders the login gate when the session is anonymous", async () => {
    sessionApi.getSession.mockResolvedValue({
      startupSyncReady: false,
      session: null,
    });

    const router = getTestRouter("/");
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.queryByTestId("login-form")).not.toBeNull());
  });

  it("renders the gym finder route inside the authenticated shell", async () => {
    authenticatedSession();
    friendsApi.getFriends.mockResolvedValue({
      role: "friend",
      handles: [],
      entries: [],
      updatedAt: null,
    });
    gymFinderApi.getGymFinderResults.mockResolvedValue({
      rankings: [],
    });

    await renderRoute("/");

    expect(screen.queryByTestId("gym-finder-page")).not.toBeNull();
  });

  it("starts a training group submission sync from the navbar and reloads after completion", async () => {
    authenticatedSession();
    friendsApi.getFriends.mockResolvedValue({
      role: "friend",
      handles: [],
      entries: [],
      updatedAt: null,
    });
    gymFinderApi.getGymFinderResults.mockResolvedValue({
      rankings: [],
    });
    teamApi.syncTeam.mockResolvedValue({
      role: "teammate",
      syncedHandles: ["Benq"],
    });

    await renderRoute("/");
    fireEvent.click(screen.getByTestId("sync-team-submissions"));

    expect(teamApi.syncTeam).toHaveBeenCalledWith({ force: true });
    await waitFor(() => expect(browserApi.reloadPage).toHaveBeenCalledTimes(1));
  });

  it("renders the team route", async () => {
    authenticatedSession();
    teamApi.getTeam.mockResolvedValue({
      role: "teammate",
      handles: ["Benq"],
      entries: [],
      updatedAt: null,
    });

    await renderRoute("/team");

    expect(screen.queryByTestId("team-page")).not.toBeNull();
  });

  it("renders the upsolving route and switches tabs", async () => {
    authenticatedSession();
    upsolvingApi.getUpsolving.mockResolvedValue({
      gyms: [],
      contests: [
        {
          contest: {
            id: 1000,
            provider: "codeforces.gym",
            providerContestKey: "1000",
            title: "Training Contest",
            url: "https://codeforces.com/gym/1000",
            startsAt: null,
            participantCount: null,
          },
          submissionCount: 3,
          acceptedCount: 1,
          problems: [],
        },
      ],
      progress: {
        totalContestCount: 1,
        readyContestCount: 1,
        pendingContestCount: 0,
        totalGymCount: 0,
        readyGymCount: 0,
        pendingGymCount: 0,
        activeGymTitle: null,
      },
    });
    await renderRoute("/upsolving");

    expect(screen.queryByTestId("upsolving-page")).not.toBeNull();
    fireEvent.click(screen.getByTestId("upsolving-tab-contests"));
    expect(screen.queryByTestId("upsolving-tab-contests")).not.toBeNull();
  });

  it("shows detailed upsolving load failures in a toast", async () => {
    authenticatedSession();
    upsolvingApi.getUpsolving.mockRejectedValue(
      new ApiError({
        status: 500,
        tag: "gym_standings_failed",
        message:
          "Codeforces contest.standings returned HTTP 400. Params: contestId=100001, from=1, count=5000, showUnofficial=true. Comment: contestId: Contest not found",
      }),
    );

    await renderRoute("/upsolving");

    await waitFor(() => {
      expect(screen.queryByText("Upsolving failed to load")).not.toBeNull();
    });
    const toastAlert = screen.getByRole("alert");
    expect(toastAlert.textContent).toContain("HTTP 500 · gym_standings_failed");
    expect(toastAlert.textContent).toContain("contestId=100001");
  });
});
