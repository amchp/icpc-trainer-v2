import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UpsolvingContest } from "../../types/upsolving";
import { UpsolvingProblemTable } from "./UpsolvingProblemTable";

const contest: UpsolvingContest = {
  contest: {
    id: 1000,
    provider: "codeforces.contest",
    providerContestKey: "1000",
    title: "Training Contest",
    url: "https://codeforces.com/contest/1000",
    startsAt: null,
    participantCount: null,
  },
  submissionCount: 3,
  acceptedCount: 0,
  problems: [
    {
      id: 1,
      contestId: 1000,
      providerProblemKey: "C",
      title: "Harder Rated",
      url: "https://codeforces.com/contest/1000/problem/C",
      position: 3,
      points: null,
      rating: 1800,
      tags: ["dp", "math"],
      solverCount: 10,
      attemptCount: null,
      submissionCount: null,
      solveRate: null,
      attempted: false,
      passed: false,
      team: {
        attemptedByTeam: false,
        solvedByTeam: false,
      },
    },
    {
      id: 2,
      contestId: 1000,
      providerProblemKey: "A",
      title: "Easier Rated",
      url: "https://codeforces.com/contest/1000/problem/A",
      position: 1,
      points: null,
      rating: 800,
      tags: ["implementation"],
      solverCount: 200,
      attemptCount: null,
      submissionCount: null,
      solveRate: null,
      attempted: false,
      passed: false,
      team: {
        attemptedByTeam: false,
        solvedByTeam: false,
      },
    },
    {
      id: 3,
      contestId: 1000,
      providerProblemKey: "B",
      title: "Unrated",
      url: "https://codeforces.com/contest/1000/problem/B",
      position: 2,
      points: null,
      rating: null,
      tags: ["math"],
      solverCount: 50,
      attemptCount: null,
      submissionCount: null,
      solveRate: null,
      attempted: false,
      passed: false,
      team: {
        attemptedByTeam: false,
        solvedByTeam: false,
      },
    },
  ],
};

const gym: UpsolvingContest = {
  ...contest,
  contest: {
    ...contest.contest,
    id: 100001,
    provider: "codeforces.gym",
    providerContestKey: "100001",
    title: "Training Gym",
    url: "https://codeforces.com/gym/100001",
  },
  problems: [
    {
      ...contest.problems[0]!,
      id: 4,
      contestId: 100001,
      providerProblemKey: "A",
      title: "Lower Attempt Rate",
      rating: 800,
      tags: [],
      solveRate: 0.25,
    },
    {
      ...contest.problems[1]!,
      id: 5,
      contestId: 100001,
      providerProblemKey: "B",
      title: "Higher Attempt Rate",
      rating: 1800,
      tags: [],
      solveRate: 0.75,
    },
  ],
};

describe("UpsolvingProblemTable", () => {
  it("uses rating as the contest problem difficulty proxy", () => {
    render(
      <UpsolvingProblemTable
        contests={[contest]}
        onCompleteProblem={vi.fn().mockResolvedValue({ ok: true })}
        onCompleteProblems={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    expect(screen.getByText("Difficulty")).not.toBeNull();

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText(/A\. Easier Rated/)).not.toBeNull();
    expect(within(rows[0]!).getByText("800")).not.toBeNull();
    expect(within(rows[1]!).getByText(/C\. Harder Rated/)).not.toBeNull();
    expect(within(rows[1]!).getByText("1800")).not.toBeNull();
    expect(within(rows[2]!).getByText(/B\. Unrated/)).not.toBeNull();
    expect(within(rows[2]!).getByText("-")).not.toBeNull();
  });

  it("keeps gyms sorted and displayed by attempt rate", () => {
    render(
      <UpsolvingProblemTable
        contests={[gym]}
        onCompleteProblem={vi.fn().mockResolvedValue({ ok: true })}
        onCompleteProblems={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    expect(screen.getByText("Attempt Rate")).not.toBeNull();

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText(/B\. Higher Attempt Rate/)).not.toBeNull();
    expect(within(rows[0]!).getByText("75.0%")).not.toBeNull();
    expect(within(rows[1]!).getByText(/A\. Lower Attempt Rate/)).not.toBeNull();
    expect(within(rows[1]!).getByText("25.0%")).not.toBeNull();
  });

  it("marks unsolved contest problems at or below the selected rating", async () => {
    const onCompleteProblem = vi.fn().mockResolvedValue({ ok: true });
    const onCompleteProblems = vi.fn().mockResolvedValue({ ok: true });

    render(
      <UpsolvingProblemTable
        contests={[contest]}
        onCompleteProblem={onCompleteProblem}
        onCompleteProblems={onCompleteProblems}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bulk mark by difficulty/i }));
    fireEvent.change(screen.getByPlaceholderText("1200"), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByRole("button", { name: /mark 1 solved/i }));

    await waitFor(() => {
      expect(onCompleteProblems).toHaveBeenCalledTimes(1);
    });
    expect(onCompleteProblems).toHaveBeenCalledWith([2]);
    expect(onCompleteProblem).not.toHaveBeenCalled();
  });

  it("marks unsolved gym problems at or above the selected attempt rate", async () => {
    const onCompleteProblem = vi.fn().mockResolvedValue({ ok: true });
    const onCompleteProblems = vi.fn().mockResolvedValue({ ok: true });

    render(
      <UpsolvingProblemTable
        contests={[gym]}
        onCompleteProblem={onCompleteProblem}
        onCompleteProblems={onCompleteProblems}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bulk mark by difficulty/i }));
    fireEvent.change(screen.getByPlaceholderText("50"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /mark 1 solved/i }));

    await waitFor(() => {
      expect(onCompleteProblems).toHaveBeenCalledTimes(1);
    });
    expect(onCompleteProblems).toHaveBeenCalledWith([5]);
    expect(onCompleteProblem).not.toHaveBeenCalled();
  });

  it("filters contest problems by tag", async () => {
    render(
      <UpsolvingProblemTable
        contests={[contest]}
        onCompleteProblem={vi.fn().mockResolvedValue({ ok: true })}
        onCompleteProblems={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: /filter by tag/i }));
    const tagItem = (await screen.findAllByRole("menuitem")).find((item) =>
      item.textContent?.includes("math"),
    );
    expect(tagItem).toBeDefined();
    fireEvent.click(tagItem!);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText(/C\. Harder Rated/)).not.toBeNull();
    expect(within(rows[1]!).getByText(/B\. Unrated/)).not.toBeNull();
    expect(screen.queryByText(/A\. Easier Rated/)).toBeNull();
  });

  it("allows selecting multiple contest tags", async () => {
    render(
      <UpsolvingProblemTable
        contests={[contest]}
        onCompleteProblem={vi.fn().mockResolvedValue({ ok: true })}
        onCompleteProblems={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: /filter by tag/i }));
    const tagItems = await screen.findAllByRole("menuitem");
    const mathItem = tagItems.find((item) => item.textContent?.includes("math"));
    const implementationItem = tagItems.find((item) =>
      item.textContent?.includes("implementation"),
    );
    expect(mathItem).toBeDefined();
    expect(implementationItem).toBeDefined();

    fireEvent.click(mathItem!);
    fireEvent.click(implementationItem!);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(screen.getByRole("button", { name: /filter by tag/i }).textContent).toContain(
      "2 selected",
    );
  });

  it("does not show the tag filter for gyms", () => {
    render(
      <UpsolvingProblemTable
        contests={[gym]}
        onCompleteProblem={vi.fn().mockResolvedValue({ ok: true })}
        onCompleteProblems={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    expect(screen.queryByRole("button", { name: /filter by tag/i })).toBeNull();
  });
});
