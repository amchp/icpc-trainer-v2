import { useCallback, useEffect, useState } from "react";
import { toast } from "../components/ui/toaster";
import { getFriends, replaceFriends, syncFriends } from "../lib/api/friends";
import { getErrorDetails, getErrorMessage } from "../lib/api/errors";
import { sessionStore } from "../stores/sessionStore";
import type { RosterResponse } from "../types/roster";

interface RosterState {
  roster: RosterResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  error: string | null;
}

const initialState: RosterState = {
  roster: null,
  isLoading: true,
  isSaving: false,
  isSyncing: false,
  error: null,
};

export function useFriendsRoster() {
  const sessionStatus = sessionStore.useStore((state) => state.status);
  const [state, setState] = useState<RosterState>(initialState);

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
      const roster = await getFriends();
      setState({
        roster,
        isLoading: false,
        isSaving: false,
        isSyncing: false,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(error, "Unable to load the friends roster.");
      const details = getErrorDetails(error);
      setState((current) => ({
        ...current,
        isLoading: false,
        error: details ? `${message} (${details})` : message,
      }));
      toast({
        title: "Friends roster failed to load",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
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
      const roster = await replaceFriends({ handles });
      setState((current) => ({
        ...current,
        roster,
        isSaving: false,
      }));
      return { ok: true as const, roster };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to save the friends roster.");
      const details = getErrorDetails(error);
      const displayMessage = details ? `${message} (${details})` : message;
      setState((current) => ({
        ...current,
        isSaving: false,
        error: displayMessage,
      }));
      toast({
        title: "Friend was not saved",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
      return { ok: false as const, error: displayMessage };
    }
  }, []);

  const sync = useCallback(async (force = false, handles?: readonly string[]) => {
    setState((current) => ({
      ...current,
      isSyncing: true,
      error: null,
    }));

    try {
      const response = await syncFriends({ force, handles: handles ? [...handles] : undefined });
      setState((current) => ({
        ...current,
        roster: response.roster,
        isSyncing: false,
      }));
      return { ok: true as const, syncedHandles: response.syncedHandles };
    } catch (error) {
      const message = getErrorMessage(error, "Unable to sync the friends roster.");
      const details = getErrorDetails(error);
      const displayMessage = details ? `${message} (${details})` : message;
      setState((current) => ({
        ...current,
        isSyncing: false,
        error: displayMessage,
      }));
      toast({
        title: "Friends sync failed",
        description: details ? `${message} ${details}` : message,
        variant: "destructive",
      });
      return { ok: false as const, error: displayMessage };
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
