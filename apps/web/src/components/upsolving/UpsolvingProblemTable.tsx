import { Check, CheckCheck, ChevronDown, ExternalLink, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UpsolvingContest, UpsolvingProblem } from "../../types/upsolving";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface ProblemRow {
  contest: UpsolvingContest["contest"];
  problem: UpsolvingProblem;
}

type StatusFilter = "all" | "new" | "attempted" | "solved";
type DifficultyMode = "gym" | "contest";

function gymAttemptRate(problem: UpsolvingProblem) {
  if (problem.solveRate === null) {
    return null;
  }

  return Math.min(problem.solveRate, 1) * 100;
}

function formatGymAttemptRate(problem: UpsolvingProblem) {
  const attemptRate = gymAttemptRate(problem);
  if (attemptRate !== null) {
    return `${attemptRate.toFixed(1)}%`;
  }

  return "-";
}

function formatContestDifficulty(problem: UpsolvingProblem) {
  if (problem.rating !== null) {
    return String(problem.rating);
  }

  return "-";
}

function problemDifficulty(problem: UpsolvingProblem, mode: DifficultyMode) {
  if (mode === "gym") {
    return gymAttemptRate(problem);
  }

  if (problem.rating !== null) {
    return problem.rating;
  }

  return null;
}

function sortableProblemDifficulty(problem: UpsolvingProblem, mode: DifficultyMode) {
  return problemDifficulty(problem, mode) ?? Number.POSITIVE_INFINITY;
}

function compareProblems(left: ProblemRow, right: ProblemRow) {
  const leftMode = left.contest.provider === "codeforces.gym" ? "gym" : "contest";
  const rightMode = right.contest.provider === "codeforces.gym" ? "gym" : "contest";

  if (leftMode === rightMode) {
    const leftDifficulty = sortableProblemDifficulty(left.problem, leftMode);
    const rightDifficulty = sortableProblemDifficulty(right.problem, rightMode);
    const difficulty =
      leftMode === "gym"
        ? rightDifficulty - leftDifficulty
        : leftDifficulty - rightDifficulty;
    if (difficulty !== 0) {
      return difficulty;
    }
  }

  return left.problem.providerProblemKey.localeCompare(
    right.problem.providerProblemKey,
    undefined,
    { numeric: true },
  );
}

function problemStatus(problem: UpsolvingProblem) {
  if (problem.passed) {
    return { label: "Solved", variant: "success" as const };
  }

  if (problem.attempted) {
    return { label: "Tried", variant: "warning" as const };
  }

  return { label: "New", variant: "accent" as const };
}

function statusFilter(problem: UpsolvingProblem): StatusFilter {
  if (problem.passed) {
    return "solved";
  }

  if (problem.attempted) {
    return "attempted";
  }

  return "new";
}

function tagKey(tag: string) {
  return tag.trim().toLowerCase();
}

export function UpsolvingProblemTable({
  contests,
  onCompleteProblem,
  onCompleteProblems,
}: {
  contests: readonly UpsolvingContest[];
  onCompleteProblem(problemId: number): Promise<{ ok: boolean }>;
  onCompleteProblems(problemIds: readonly number[]): Promise<{ ok: boolean }>;
}) {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("new");
  const [selectedTags, setSelectedTags] = useState<readonly string[]>([]);
  const [thresholds, setThresholds] = useState<Record<DifficultyMode, string>>({
    gym: "",
    contest: "",
  });
  const [armedProblemId, setArmedProblemId] = useState<number | null>(null);
  const [completingProblemId, setCompletingProblemId] = useState<number | null>(null);
  const [isCompletingByDifficulty, setIsCompletingByDifficulty] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const allRows = useMemo<ProblemRow[]>(() => {
    return contests
      .flatMap((contest) =>
        contest.problems.map((problem) => ({
          contest: contest.contest,
          problem,
        })),
      )
      .sort(compareProblems);
  }, [contests]);
  const difficultyMode: DifficultyMode =
    contests.every((contest) => contest.contest.provider === "codeforces.gym")
      ? "gym"
      : "contest";
  const thresholdValue = thresholds[difficultyMode];
  const parsedThreshold = Number(thresholdValue);
  const hasValidThreshold =
    thresholdValue.trim() !== "" &&
    Number.isFinite(parsedThreshold) &&
    parsedThreshold >= 0 &&
    (difficultyMode === "contest" || parsedThreshold <= 100);
  const maxDifficulty = parsedThreshold;
  const metricLabel = difficultyMode === "gym" ? "Attempt Rate" : "Difficulty";
  const showTagFilter = difficultyMode === "contest";
  const tagOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();

    for (const row of allRows) {
      const uniqueProblemTags = new Set(row.problem.tags.map(tagKey));
      for (const key of uniqueProblemTags) {
        const label = row.problem.tags.find((tag) => tagKey(tag) === key)?.trim();
        if (!label) {
          continue;
        }
        const current = counts.get(key);
        counts.set(key, {
          label: current?.label ?? label,
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    return [...counts.entries()]
      .map(([value, option]) => ({ value, ...option }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [allRows]);
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: allRows.length,
      new: 0,
      attempted: 0,
      solved: 0,
    };

    for (const row of allRows) {
      counts[statusFilter(row.problem)] += 1;
    }

    return counts;
  }, [allRows]);

  useEffect(() => {
    if (!showTagFilter) {
      if (selectedTags.length > 0) {
        setSelectedTags([]);
      }
      return;
    }

    const availableTags = new Set(tagOptions.map((option) => option.value));
    const nextSelectedTags = selectedTags.filter((tag) => availableTags.has(tag));
    if (nextSelectedTags.length !== selectedTags.length) {
      setSelectedTags(nextSelectedTags);
    }
  }, [selectedTags, showTagFilter, tagOptions]);

  const rows = useMemo(() => {
    const selectedTagSet = new Set(selectedTags);

    return allRows.filter((row) => {
      const matchesStatus =
        selectedStatus === "all" || statusFilter(row.problem) === selectedStatus;
      const matchesTag =
        selectedTagSet.size === 0 ||
        row.problem.tags.some((tag) => selectedTagSet.has(tagKey(tag)));

      return matchesStatus && (!showTagFilter || matchesTag);
    });
  }, [allRows, selectedStatus, selectedTags, showTagFilter]);
  const matchingUnsolvedRows = useMemo(() => {
    if (!hasValidThreshold) {
      return [];
    }

    return allRows.filter((row) => {
      if (row.problem.passed) {
        return false;
      }

      const difficulty = problemDifficulty(row.problem, difficultyMode);
      if (difficulty === null) {
        return false;
      }

      return difficultyMode === "gym"
        ? difficulty >= maxDifficulty
        : difficulty <= maxDifficulty;
    });
  }, [allRows, difficultyMode, hasValidThreshold, maxDifficulty]);

  if (allRows.length === 0) {
    return (
      <div className="py-8 text-sm text-[var(--text-muted)]">
        No synced problems yet. Use the sync button to pull contest standings.
      </div>
    );
  }

  const selectedLabel =
    selectedStatus === "all"
      ? "All"
      : selectedStatus === "new"
        ? "New"
        : selectedStatus === "attempted"
          ? "Attempted"
          : "Solved";
  const thresholdLabel =
    difficultyMode === "gym" ? "Minimum attempt rate %" : "Max contest rating";
  const thresholdPlaceholder = difficultyMode === "gym" ? "50" : "1200";
  const selectedTagLabel =
    selectedTags.length === 0
      ? "All"
      : selectedTags.length === 1
        ? tagOptions.find((option) => option.value === selectedTags[0])?.label ?? "1 selected"
        : `${selectedTags.length} selected`;
  const selectedTagSet = new Set(selectedTags);

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selectedTag) => selectedTag !== tag)
        : [...current, tag],
    );
  }

  async function completeByDifficulty() {
    if (!hasValidThreshold || matchingUnsolvedRows.length === 0 || isCompletingByDifficulty) {
      return;
    }

    setIsCompletingByDifficulty(true);
    try {
      const result = await onCompleteProblems(
        matchingUnsolvedRows.map((row) => row.problem.id),
      );
      if (result.ok) {
        setShowBulkModal(false);
      }
    } finally {
      setIsCompletingByDifficulty(false);
    }
  }

  async function completeProblem(problem: UpsolvingProblem) {
    if (problem.passed || completingProblemId === problem.id) {
      return;
    }

    if (armedProblemId !== problem.id) {
      setArmedProblemId(problem.id);
      return;
    }

    setCompletingProblemId(problem.id);
    const result = await onCompleteProblem(problem.id);
    setCompletingProblemId(null);
    if (result.ok) {
      setArmedProblemId(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" aria-label="Filter by status">
              <span className="text-[var(--text-soft)]">Status</span>
              {selectedLabel}
              <span className="tabular-nums text-[var(--text-soft)]">
                ({statusCounts[selectedStatus]})
              </span>
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {([
              ["all", "All statuses"],
              ["new", "New"],
              ["attempted", "Attempted"],
              ["solved", "Solved"],
            ] as const).map(([value, label]) => (
              <DropdownMenuItem key={value} onClick={() => setSelectedStatus(value)}>
                <span className="flex-1">{label}</span>
                <span className="tabular-nums text-[var(--text-soft)]">
                  {statusCounts[value]}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {showTagFilter && tagOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" aria-label="Filter by tag" className="max-w-full">
                <span className="text-[var(--text-soft)]">Tag</span>
                <span className="max-w-36 truncate">{selectedTagLabel}</span>
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setSelectedTags([]);
                }}
              >
                <span className="w-4" />
                <span className="flex-1">Clear tags</span>
                <span className="tabular-nums text-[var(--text-soft)]">
                  {allRows.length}
                </span>
              </DropdownMenuItem>
              {tagOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={(event) => {
                    event.preventDefault();
                    toggleTag(option.value);
                  }}
                >
                  <span className="w-4">
                    {selectedTagSet.has(option.value) && <Check size={13} />}
                  </span>
                  <span className="flex-1">{option.label}</span>
                  <span className="tabular-nums text-[var(--text-soft)]">
                    {option.count}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setShowBulkModal(true)}
        >
          <CheckCheck size={13} />
          Bulk mark by difficulty
        </Button>
      </div>

      <div className="grid gap-2 md:hidden" data-testid="upsolving-problem-cards">
        {rows.map(({ contest, problem }, index) => {
          const status = problemStatus(problem);
          const isArmed = armedProblemId === problem.id;
          const isCompleting = completingProblemId === problem.id;
          const metricValue =
            contest.provider === "codeforces.gym"
              ? formatGymAttemptRate(problem)
              : formatContestDifficulty(problem);

          return (
            <div
              key={`${contest.id}:${problem.id}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <span className="shrink-0 font-mono text-xs text-[var(--text-soft)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    className="break-words font-medium text-[var(--accent)] no-underline hover:underline"
                    href={problem.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {problem.providerProblemKey}. {problem.title}
                  </a>
                  <p className="mt-1 break-words text-xs text-[var(--text-soft)]">
                    {contest.title}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <Badge variant={status.variant}>{status.label}</Badge>
                <span className="font-medium text-[var(--text-muted)]">
                  {metricLabel}: {metricValue}
                </span>
              </div>

              {showTagFilter && problem.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
                  {problem.tags.slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  {problem.tags.length > 4 && <span>+{problem.tags.length - 4}</span>}
                </div>
              )}

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="icon"
                  variant={problem.passed ? "default" : isArmed ? "default" : "secondary"}
                  type="button"
                  disabled={problem.passed || isCompleting}
                  aria-label={
                    problem.passed
                      ? "Problem completed"
                      : isArmed
                        ? "Confirm completion"
                        : "Mark problem complete"
                  }
                  onClick={() => void completeProblem(problem)}
                >
                  {problem.passed ? <CheckCheck size={14} /> : <Check size={14} />}
                </Button>
                <Button asChild size="icon" variant="secondary">
                  <a href={problem.url} target="_blank" rel="noreferrer" aria-label="Open problem">
                    <ExternalLink size={14} />
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        <Table data-testid="upsolving-problem-table" className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Problem</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-28">{metricLabel}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
          {rows.map(({ contest, problem }, index) => {
            const status = problemStatus(problem);
            const isArmed = armedProblemId === problem.id;
            const isCompleting = completingProblemId === problem.id;

            return (
              <TableRow key={`${contest.id}:${problem.id}`}>
                <TableCell className="font-mono text-xs text-[var(--text-soft)]">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <a
                    className="break-words font-medium text-[var(--accent)] no-underline hover:underline"
                    href={problem.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {problem.providerProblemKey}. {problem.title}
                  </a>
                  <p className="mt-1 break-words text-xs text-[var(--text-soft)]">{contest.title}</p>
                  {showTagFilter && problem.tags.length > 0 && (
                    <div className="mt-1.5 flex max-w-xl flex-wrap gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
                      {problem.tags.slice(0, 4).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                      {problem.tags.length > 4 && (
                        <span>+{problem.tags.length - 4}</span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {contest.provider === "codeforces.gym"
                    ? formatGymAttemptRate(problem)
                    : formatContestDifficulty(problem)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="icon"
                      variant={problem.passed ? "default" : isArmed ? "default" : "secondary"}
                      type="button"
                      disabled={problem.passed || isCompleting}
                      aria-label={
                        problem.passed
                          ? "Problem completed"
                          : isArmed
                            ? "Confirm completion"
                            : "Mark problem complete"
                      }
                      onClick={() => void completeProblem(problem)}
                    >
                      {problem.passed ? <CheckCheck size={14} /> : <Check size={14} />}
                    </Button>
                    <Button asChild size="icon" variant="secondary">
                      <a href={problem.url} target="_blank" rel="noreferrer" aria-label="Open problem">
                        <ExternalLink size={14} />
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
      </div>
      {showBulkModal && (
        <BulkMarkModal
          difficultyMode={difficultyMode}
          thresholdValue={thresholdValue}
          thresholdLabel={thresholdLabel}
          thresholdPlaceholder={thresholdPlaceholder}
          matchingCount={matchingUnsolvedRows.length}
          isCompleting={isCompletingByDifficulty}
          onThresholdChange={(value) =>
            setThresholds((current) => ({ ...current, [difficultyMode]: value }))
          }
          onConfirm={() => void completeByDifficulty()}
          onClose={() => setShowBulkModal(false)}
          canConfirm={hasValidThreshold && matchingUnsolvedRows.length > 0}
        />
      )}
    </div>
  );
}

function BulkMarkModal({
  difficultyMode,
  thresholdValue,
  thresholdLabel,
  thresholdPlaceholder,
  matchingCount,
  isCompleting,
  onThresholdChange,
  onConfirm,
  onClose,
  canConfirm,
}: {
  difficultyMode: DifficultyMode;
  thresholdValue: string;
  thresholdLabel: string;
  thresholdPlaceholder: string;
  matchingCount: number;
  isCompleting: boolean;
  onThresholdChange(value: string): void;
  onConfirm(): void;
  onClose(): void;
  canConfirm: boolean;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bulk mark solved</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-soft)] transition hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            {thresholdLabel}
          </span>
          <input
            className="w-full rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-soft)] focus:ring-1 focus:ring-[var(--accent)]"
            inputMode="numeric"
            type="number"
            min={0}
            max={difficultyMode === "gym" ? 100 : undefined}
            step={difficultyMode === "gym" ? 1 : 100}
            placeholder={thresholdPlaceholder}
            value={thresholdValue}
            onChange={(e) => onThresholdChange(e.target.value)}
            disabled={isCompleting}
            autoFocus
          />
        </label>

        <p className="mt-3 text-xs text-[var(--text-soft)]">
          {canConfirm
            ? `${matchingCount} unsolved problem${matchingCount === 1 ? "" : "s"} will be marked as solved.`
            : "Enter a threshold to see matching problems."}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isCompleting}
          >
            {isCompleting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CheckCheck size={13} />
            )}
            Mark {matchingCount} solved
          </Button>
        </div>
      </div>
    </div>
  );
}
