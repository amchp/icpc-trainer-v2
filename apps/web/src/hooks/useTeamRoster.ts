import { useCallback, useEffect, useState } from "react";
import { getTeam, replaceTeam, syncTeam } from "../lib/api/team";
import { getErrorMessage } from "../lib/api/errors";
import { sessionStore } from "../stores/sessionStore";
import type { RosterResponse } from "../types/roster";

interface TeamRosterState {
  roster: RosterResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  error: string | null;
}

const initialState: TeamRosterState = {
  roster: null,
  isLoading: true,
  isSaving: false,
  isSyncing: false,
  error: null,
};

export function useTeamRoster() {
  const sessionStatus = sessionStore.useStore((state) => state.status);
  const [state, setState] = useState<TeamRosterState>(initialState);

  const load = useCallback(async () => {
    if (sessionStatus !== "authenticated") {
      setState({
        ...initialState,
        isLoading: false,
      });
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      const roster = await getTeam();
      setState({
        roster,
        isLoading: false,
        isSaving: false,
        isSyncing: false,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: getErrorMessage(error, "Unable to load the team roster."),
      }));
    }
  }, [sessionStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = useCallback(async (handles: string[]) => {
    setState((current) => ({
      ...current,
      isSaving: true,
      error: null,
    }));

    try {
      const roster = await replaceTeam({ handles });
      setState((current) => ({
        ...current,
        roster,
        isSaving: false,
      }));
      return { ok: true as const, roster };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to save the team roster.");
      setState((current) => ({
        ...current,
        isSaving: false,
        error: message,
      }));
      return { ok: false as const, error: message };
    }
  }, []);

  const sync = useCallback(async (force = false) => {
    setState((current) => ({
      ...current,
      isSyncing: true,
      error: null,
    }));

    try {
      const response = await syncTeam({ force });
      setState((current) => ({
        ...current,
        roster: response.roster,
        isSyncing: false,
      }));
      return { ok: true as const, syncedHandles: response.syncedHandles };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to sync the team roster.");
      setState((current) => ({
        ...current,
        isSyncing: false,
        error: message,
      }));
      return { ok: false as const, error: message };
    }
  }, []);

  return {
    ...state,
    load,
    replace,
    sync,
    handles: state.roster?.handles ?? [],
    entries: state.roster?.entries ?? [],
    updatedAt: state.roster?.updatedAt ?? null,
  };
}
