import { CheckCircle2, Circle, ExternalLink, Flame } from "lucide-react";
import type { UpsolvingProblem } from "../../types/upsolving";

function ProblemFlag({
  active,
  label,
  variant,
}: {
  active: boolean;
  label: string;
  variant: "green" | "amber" | "default";
}) {
  const styles = {
    green: active ? "text-emerald-400" : "text-[var(--text-soft)]",
    amber: active ? "text-amber-400" : "text-[var(--text-soft)]",
    default: "text-[var(--text-soft)]",
  };

  return (
    <span className={`text-[11px] font-medium ${styles[variant]}`}>
      {label}
    </span>
  );
}

export function UpsolvingProblemList({ problems }: { problems: readonly UpsolvingProblem[] }) {
  return (
    <div className="grid gap-2.5" data-testid="upsolving-problem-list">
      {problems.map((problem) => (
        <article
          key={problem.id}
          className="group border-b border-[var(--border)] py-3 transition hover:bg-[var(--bg-hover)]"
          data-testid="upsolving-problem-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {problem.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : problem.attempted ? (
                <Flame className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-soft)]" />
              )}
              <div>
                <h4 className="font-semibold tracking-tight">
                  {problem.providerProblemKey}. {problem.title}
                </h4>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  rating {problem.rating ?? "?"} &middot; solves {problem.solverCount ?? "?"}
                </p>
              </div>
            </div>

            <a
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] no-underline transition hover:text-[var(--text)]"
              href={problem.url}
              target="_blank"
              rel="noreferrer"
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="mt-2 flex flex-wrap gap-3">
            <ProblemFlag
              active={problem.passed}
              label={problem.passed ? "passed" : "open"}
              variant="green"
            />
            <ProblemFlag
              active={problem.attempted}
              label={problem.attempted ? "attempted" : "fresh"}
              variant="amber"
            />
            <ProblemFlag
              active={problem.team.solvedByTeam}
              label={problem.team.solvedByTeam ? "team solved" : "team open"}
              variant="green"
            />
          </div>
        </article>
      ))}
    </div>
  );
}
