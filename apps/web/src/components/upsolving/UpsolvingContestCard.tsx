import { ChevronDown, ChevronRight } from "lucide-react";
import { formatContestCount, formatTimestamp } from "../../lib/format";
import type { UpsolvingContest } from "../../types/upsolving";

export function UpsolvingContestCard({
  contest,
  expanded,
  onToggle,
}: {
  contest: UpsolvingContest;
  expanded: boolean;
  onToggle(contestId: number | null): void;
}) {
  return (
    <article className="border-b border-[var(--border)] transition hover:bg-[var(--bg-hover)]">
      <button
        className="flex w-full items-start justify-between gap-4 py-3 text-left"
        data-testid="upsolving-contest-toggle"
        type="button"
        onClick={() => onToggle(expanded ? null : contest.contest.id)}
      >
        <div className="flex items-start gap-3">
          {expanded ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-soft)]" />
          )}
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Contest
            </p>
            <h3 className="mt-0.5 font-semibold tracking-tight">{contest.contest.title}</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              starts {formatTimestamp(contest.contest.startsAt)} &middot;{" "}
              {formatContestCount(contest.problems.length, "problem")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{contest.acceptedCount} AC</span>
          <span className="text-[var(--text-muted)]">{contest.submissionCount} subs</span>
        </div>
      </button>
    </article>
  );
}
