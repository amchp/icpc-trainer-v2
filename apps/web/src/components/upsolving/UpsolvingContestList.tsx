import type { UpsolvingContest } from "../../types/upsolving";
import { UpsolvingContestCard } from "./UpsolvingContestCard";
import { UpsolvingProblemList } from "./UpsolvingProblemList";

export function UpsolvingContestList({
  contests,
  selectedContest,
  selectedContestId,
  selectedContestError,
  onSelectContest,
}: {
  contests: readonly UpsolvingContest[];
  selectedContest: UpsolvingContest | null;
  selectedContestId: number | null;
  selectedContestError: string | null;
  onSelectContest(contestId: number | null): void;
}) {
  return (
    <div className="mt-4 grid gap-3" data-testid="upsolving-contest-list">
      {contests.map((contest) => {
        const expanded = selectedContestId === contest.contest.id;
        const detail = expanded ? (selectedContest ?? contest) : null;

        return (
          <section key={contest.contest.id} className="grid gap-px">
            <UpsolvingContestCard
              contest={contest}
              expanded={expanded}
              onToggle={onSelectContest}
            />
            {expanded && (
              <div
                className="rounded-b-xl border border-t-0 border-[var(--border)] bg-[var(--bg-elevated)] p-4"
                data-testid="upsolving-contest-detail"
              >
                {selectedContestError && (
                  <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <p className="text-sm text-red-300">{selectedContestError}</p>
                  </div>
                )}
                {detail && <UpsolvingProblemList problems={detail.problems} />}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
