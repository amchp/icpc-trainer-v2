import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../components/ui/toaster";
import { getErrorDetails, getErrorMessage } from "../lib/api/errors";
import {
  completeUpsolvingProblem,
  completeUpsolvingProblems,
  getUpsolving,
  syncUpsolving,
} from "../lib/api/upsolving";
import { resolveApiBaseUrl } from "../lib/runtime";
import { sessionStore } from "../stores/sessionStore";
import { uiStore, type UpsolvingTabId } from "../stores/uiStore";
import type {
  UpsolvingContest,
  UpsolvingOverviewResponse,
  UpsolvingProgress,
} from "../types/upsolving";

interface UpsolvingState {
  data: UpsolvingOverviewResponse | null;
  eventProgress: UpsolvingProgress | null;
  isLoading: boolean;
  isRefreshing: boolean;
  showSyncProgress: boolean;
  error: string | null;
}

export function useUpsolving() {
  const sessionStatus = sessionStore.useStore((state) => state.status);
  const activeTab = uiStore.useStore((state) => state.activeUpsolvingTab);
  const [state, setState] = useState<UpsolvingState>({
    data: null,
    eventProgress: null,
    isLoading: true,
    isRefreshing: false,
    showSyncProgress: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (sessionStatus !== "authenticated") {
      setState({
        data: null,
        eventProgress: null,
        isLoading: false,
        isRefreshing: false,
        showSyncProgress: false,
        error: null,
      });
      return null;
    }

    setState((current) => ({
      ...current,
      isLoading: current.data === null,
      isRefreshing: current.data !== null,
      error: null,
    }));

    try {
      const data = await getUpsolving();
      setState((current) => ({
        ...current,
        data,
        eventProgress: null,
        isLoading: false,
        isRefreshing: false,
      }));
      return data;
    } catch (error) {
      const message = getErrorMessage(error, "Unable to load upsolving.");
      const details = getErrorDetails(error);
      const displayMessage = details ? `${message} (${details})` : message;
      setState((current) => ({
        ...current,
        isLoading: false,
        isRefreshing: false,
        error: displayMessage,
      }));
      toast({
        title: "Upsolving failed to load",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
      return null;
    }
  }, [sessionStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || typeof EventSource === "undefined") {
      return;
    }

    const events = new EventSource(`${resolveApiBaseUrl()}/api/upsolving/events`);
    events.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as {
          readonly type?: string;
          readonly progress?: UpsolvingProgress;
          readonly contest?: UpsolvingContest;
        };
        if (
          (event.type === "sync.progress" || event.type === "sync.completed") &&
          event.progress
        ) {
          const progress = event.progress;
          setState((current) => ({
            ...current,
            eventProgress: progress,
            data: current.data
              ? {
                  ...current.data,
                  progress,
                  gyms: event.contest
                    ? [
                        ...current.data.gyms.filter(
                          (entry) => entry.contest.id !== event.contest?.contest.id,
                        ),
                        event.contest,
                      ]
                    : current.data.gyms,
            }
              : current.data,
            isRefreshing: current.isRefreshing,
          }));
        }
      } catch {
        // Ignore malformed events from a stale connection.
      }
    };

    return () => {
      events.close();
    };
  }, [sessionStatus]);

  const refresh = useCallback(async (force = false) => {
    if (sessionStatus !== "authenticated") {
      return;
    }

    try {
      setState((current) => ({
        ...current,
        isRefreshing: true,
        showSyncProgress: true,
      }));

      await syncUpsolving(force);
      await load();
      setState((current) => ({
        ...current,
        showSyncProgress: false,
      }));
    } catch (error) {
      const message = getErrorMessage(error, "Unable to refresh upsolving.");
      const details = getErrorDetails(error);
      const displayMessage = details ? `${message} (${details})` : message;
      setState((current) => ({
        ...current,
        error: displayMessage,
        isRefreshing: false,
        isLoading: false,
        showSyncProgress: false,
      }));
      toast({
        title: "Upsolving sync failed",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
    }
  }, [load, sessionStatus]);

  const completeProblem = useCallback(async (problemId: number) => {
    if (sessionStatus !== "authenticated") {
      return { ok: false as const };
    }

    try {
      await completeUpsolvingProblem(problemId);
      setState((current) => ({
        ...current,
        data: current.data
          ? {
              ...current.data,
              gyms: current.data.gyms.map((entry) => ({
                ...entry,
                problems: entry.problems.map((problem) =>
                  problem.id === problemId
                    ? { ...problem, attempted: true, passed: true }
                    : problem,
                ),
              })),
              contests: current.data.contests.map((entry) => ({
                ...entry,
                problems: entry.problems.map((problem) =>
                  problem.id === problemId
                    ? { ...problem, attempted: true, passed: true }
                    : problem,
                ),
              })),
            }
          : current.data,
      }));
      return { ok: true as const };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to mark problem complete.");
      const details = getErrorDetails(error);
      toast({
        title: "Completion update failed",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
      return { ok: false as const };
    }
  }, [sessionStatus]);

  const completeProblems = useCallback(async (problemIds: readonly number[]) => {
    if (sessionStatus !== "authenticated") {
      return { ok: false as const };
    }

    const uniqueProblemIds = [...new Set(problemIds)];
    if (uniqueProblemIds.length === 0) {
      return { ok: true as const };
    }

    try {
      await completeUpsolvingProblems(uniqueProblemIds);
      const completedProblemIds = new Set(uniqueProblemIds);
      setState((current) => ({
        ...current,
        data: current.data
          ? {
              ...current.data,
              gyms: current.data.gyms.map((entry) => ({
                ...entry,
                problems: entry.problems.map((problem) =>
                  completedProblemIds.has(problem.id)
                    ? { ...problem, attempted: true, passed: true }
                    : problem,
                ),
              })),
              contests: current.data.contests.map((entry) => ({
                ...entry,
                problems: entry.problems.map((problem) =>
                  completedProblemIds.has(problem.id)
                    ? { ...problem, attempted: true, passed: true }
                    : problem,
                ),
              })),
            }
          : current.data,
      }));
      return { ok: true as const };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to mark problems complete.");
      const details = getErrorDetails(error);
      toast({
        title: "Bulk completion update failed",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
      return { ok: false as const };
    }
  }, [sessionStatus]);

  const selectTab = useCallback((tab: UpsolvingTabId) => {
    uiStore.setActiveUpsolvingTab(tab);
  }, []);

  const contests = state.data?.contests ?? [];
  const gyms = state.data?.gyms ?? [];
  const progress = state.eventProgress ?? state.data?.progress ?? {
    totalContestCount: 0,
    readyContestCount: 0,
    pendingContestCount: 0,
    totalGymCount: 0,
    readyGymCount: 0,
    pendingGymCount: 0,
    activeGymTitle: null,
  };

  const activeItems = useMemo(() => {
    return activeTab === "gyms" ? gyms : contests;
  }, [activeTab, contests, gyms]);

  const viewState = useMemo(() => {
    if (sessionStatus !== "authenticated") {
      return "unauthenticated" as const;
    }

    if (state.isLoading) {
      return "loading" as const;
    }

    if (state.error && activeItems.length > 0) {
      return "stale" as const;
    }

    if (state.error) {
      return "error" as const;
    }

    if (activeItems.length === 0) {
      return "empty" as const;
    }

    return "data" as const;
  }, [activeItems.length, sessionStatus, state.error, state.isLoading]);

  return {
    ...state,
    activeTab,
    contests,
    gyms,
    progress,
    activeItems,
    viewState,
    refresh,
    reload: load,
    completeProblem,
    completeProblems,
    selectTab,
  };
}
