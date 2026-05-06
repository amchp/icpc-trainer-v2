import { ExternalLink } from "lucide-react";
import { formatCoverage, formatTimestamp } from "../../lib/format";
import type { GymFinderRanking } from "../../types/gymFinder";

export function GymFinderResults({
  rankings,
  topRanking,
  isRefreshing,
  viewState,
}: {
  rankings: readonly GymFinderRanking[];
  topRanking: GymFinderRanking | null;
  isRefreshing: boolean;
  viewState: string;
}) {
  if (viewState !== "data" && viewState !== "stale" && viewState !== "empty-results") {
    return null;
  }

  if (rankings.length === 0 && !topRanking) {
    return (
      <section className="fade-in py-12 text-center">
        <p className="text-sm text-[var(--text-soft)]">
          No gyms met the overlap threshold for this group.
        </p>
      </section>
    );
  }

  return (
    <>
      {topRanking && (
        <section className="fade-in delay-1 mb-12">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            #1 Result
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="min-w-0 break-words text-2xl font-bold sm:text-3xl">{topRanking.contest.title}</h2>
            <a
              href={topRanking.contest.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Open gym <ExternalLink size={13} />
            </a>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Stat label="Friends" value={String(topRanking.friendCount)} />
            <Stat label="Coverage" value={formatCoverage(topRanking.coverage)} />
            <Stat label="Participants" value={String(topRanking.contest.participantCount)} />
            <Stat label="Date" value={formatTimestamp(topRanking.contest.startsAt)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {topRanking.handles.map((handle) => (
              <span
                key={handle}
                className="font-mono text-xs text-[var(--text-muted)]"
              >
                {handle}
              </span>
            ))}
          </div>
        </section>
      )}

      {rankings.length > 0 && (
        <section className="fade-in delay-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--text-soft)]">
            All results
            {isRefreshing && (
              <span className="ml-2 font-normal normal-case tracking-normal text-[var(--text-soft)]">
                · refreshing...
              </span>
            )}
          </h3>
          <div className="space-y-0">
            {rankings.map((ranking, index) => (
              <div
                key={ranking.contest.id}
                className="group flex items-baseline gap-3 border-b border-[var(--border)] py-3 transition hover:bg-[var(--bg-hover)] sm:gap-4"
                data-testid="gym-finder-result-card"
              >
                <span className="w-6 shrink-0 text-right font-mono text-xs text-[var(--text-soft)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="break-words text-sm font-semibold">{ranking.contest.title}</span>
                    <span className="text-xs text-[var(--text-soft)]">
                      {ranking.friendCount} friend{ranking.friendCount === 1 ? "" : "s"} ·{" "}
                      {formatCoverage(ranking.coverage)}
                    </span>
                  </div>
                  <div className="mt-0.5 break-words text-xs text-[var(--text-soft)]">
                    {ranking.handles.join(", ")} · {formatTimestamp(ranking.contest.startsAt)}
                  </div>
                </div>
                <a
                  href={ranking.contest.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-medium text-[var(--text-soft)] opacity-100 transition group-hover:text-[var(--accent)] sm:opacity-0 sm:group-hover:opacity-100"
                  data-testid="gym-finder-contest-link"
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[var(--text-soft)]">{label}</span>{" "}
      <span className="font-semibold">{value}</span>
    </div>
  );
}
