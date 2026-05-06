import { Loader2, RefreshCw } from "lucide-react";
import { useUpsolving } from "../../hooks/useUpsolving";
import { formatContestCount } from "../../lib/format";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { UpsolvingEmptyState } from "./UpsolvingEmptyState";
import { UpsolvingProblemTable } from "./UpsolvingProblemTable";
import { UpsolvingTabs } from "./UpsolvingTabs";

export function UpsolvingPage() {
  const upsolving = useUpsolving();

  const totalCount = upsolving.activeItems.length;
  const progressValue =
    upsolving.progress.totalContestCount > 0
      ? (upsolving.progress.readyContestCount / upsolving.progress.totalContestCount) * 100
      : 100;
  const isPreparingGyms = upsolving.showSyncProgress && upsolving.progress.pendingGymCount > 0;
  const isSyncingWithoutProgress =
    upsolving.showSyncProgress && upsolving.progress.pendingContestCount === 0;
  const hasProgress =
    upsolving.viewState === "loading" ||
    upsolving.showSyncProgress;
  const pendingGymText =
    upsolving.progress.pendingGymCount > 0
      ? `${upsolving.progress.pendingGymCount} pending gym${
          upsolving.progress.pendingGymCount === 1 ? "" : "s"
        } to sync`
      : null;

  return (
    <main data-testid="upsolving-page">
      <section className="fade-in mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Upsolving</h1>
      </section>

      <section className="fade-in mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <UpsolvingTabs activeTab={upsolving.activeTab} onChange={upsolving.selectTab} />

          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              variant="secondary"
              type="button"
              onClick={() => void upsolving.refresh(true)}
              disabled={upsolving.isRefreshing}
            >
              {upsolving.isRefreshing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {upsolving.isRefreshing ? "Syncing..." : "Sync Codeforces Problems"}
            </Button>
            {pendingGymText && (
              <p className="text-xs text-[var(--text-soft)]">{pendingGymText}</p>
            )}
          </div>
        </div>
      </section>

      {totalCount > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-[var(--text-soft)]">
          <span>
            {formatContestCount(upsolving.gyms.length, "gym")} · {formatContestCount(upsolving.contests.length, "contest")}
          </span>
          {isPreparingGyms && (
            <span className="font-medium text-[var(--accent)]">
              {upsolving.progress.pendingGymCount} gym{upsolving.progress.pendingGymCount === 1 ? "" : "s"} pending
            </span>
          )}
        </div>
      )}

      {hasProgress && (
        <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span className="inline-flex min-w-0 items-center gap-2">
              {(upsolving.viewState === "loading" || upsolving.showSyncProgress) && (
                <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
              )}
              {isPreparingGyms
                ? `Synced ${upsolving.progress.readyContestCount}/${upsolving.progress.totalContestCount} contests`
                : upsolving.viewState === "loading"
                  ? "Loading upsolving data"
                  : isSyncingWithoutProgress
                    ? "Syncing Codeforces problems"
                    : `Synced ${upsolving.progress.readyContestCount}/${upsolving.progress.totalContestCount} contests`}
            </span>
            {upsolving.progress.activeGymTitle && (
              <span className="max-w-full truncate text-[var(--text-soft)] sm:max-w-[50%]">
                {upsolving.progress.activeGymTitle}
              </span>
            )}
          </div>
          <Progress
            value={upsolving.viewState === "loading" || isSyncingWithoutProgress ? 12 : progressValue}
          />
          {upsolving.progress.totalGymCount > 0 && (
            <p className="mt-2 text-xs text-[var(--text-soft)]">
              Gyms {upsolving.progress.readyGymCount}/{upsolving.progress.totalGymCount} ready
            </p>
          )}
        </div>
      )}

      {(upsolving.viewState === "error" || upsolving.viewState === "stale") && upsolving.error && (
        <div className="mb-4 py-3">
          <p className="text-sm text-red-300">{upsolving.error}</p>
        </div>
      )}

      {upsolving.viewState === "empty" && !isPreparingGyms && (
        <UpsolvingEmptyState tab={upsolving.activeTab} />
      )}

      {(upsolving.viewState === "data" || upsolving.viewState === "stale" || isPreparingGyms) && (
        <UpsolvingProblemTable
          contests={upsolving.activeItems}
          onCompleteProblem={upsolving.completeProblem}
          onCompleteProblems={upsolving.completeProblems}
        />
      )}
    </main>
  );
}
