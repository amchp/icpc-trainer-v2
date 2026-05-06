import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../components/ui/toaster";
import { getGymFinderResults } from "../lib/api/gymFinder";
import { getErrorDetails, getErrorMessage } from "../lib/api/errors";
import { sessionStore } from "../stores/sessionStore";
import type { GymFinderResponse } from "../types/gymFinder";

interface GymFinderState {
  data: GymFinderResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

export function useGymFinder(friendCount: number) {
  const sessionStatus = sessionStore.useStore((state) => state.status);
  const [state, setState] = useState<GymFinderState>({
    data: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (sessionStatus !== "authenticated") {
      setState({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
      return { ok: false as const, reason: "unauthenticated" as const };
    }

    if (friendCount === 0) {
      setState({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
      return { ok: false as const, reason: "empty-friends" as const };
    }

    setState((current) => ({
      ...current,
      isLoading: current.data === null,
      isRefreshing: current.data !== null,
      error: null,
    }));

    try {
      const data = await getGymFinderResults();
      setState({
        data,
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
      return { ok: true as const, data };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to load gym recommendations.");
      const details = getErrorDetails(error);
      setState((current) => ({
        ...current,
        isLoading: false,
        isRefreshing: false,
        error: details ? `${message} (${details})` : message,
      }));
      toast({
        title: "Gym search failed",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
      return {
        ok: false as const,
        reason: "request-failed" as const,
        error: details ? `${message} (${details})` : message,
      };
    }
  }, [friendCount, sessionStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewState = useMemo(() => {
    if (sessionStatus !== "authenticated") {
      return "unauthenticated" as const;
    }

    if (friendCount === 0) {
      return "empty-friends" as const;
    }

    if (state.isLoading) {
      return "loading" as const;
    }

    if (state.error && state.data?.rankings.length) {
      return "stale" as const;
    }

    if (state.error) {
      return "error" as const;
    }

    if ((state.data?.rankings.length ?? 0) === 0) {
      return "empty-results" as const;
    }

    return "data" as const;
  }, [friendCount, sessionStatus, state.data, state.error, state.isLoading]);

  return {
    ...state,
    viewState,
    reload: load,
    rankings: state.data?.rankings ?? [],
    topRanking: state.data?.rankings[0] ?? null,
  };
}
