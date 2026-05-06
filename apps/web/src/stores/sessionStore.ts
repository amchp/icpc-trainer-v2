import { getSession, loginSession, logoutSession } from "../lib/api/session";
import { getErrorMessage } from "../lib/api/errors";
import { createStore } from "../lib/store";
import type { LoginInput, SessionResponse } from "../types/session";

export type SessionStatus = "booting" | "anonymous" | "authenticated";

export interface SessionState {
  status: SessionStatus;
  currentHandle: string | null;
  authenticatedAt: string | null;
  lastValidatedAt: string | null;
  loginError: string | null;
  startupSyncReady: boolean;
}

const initialState: SessionState = {
  status: "booting",
  currentHandle: null,
  authenticatedAt: null,
  lastValidatedAt: null,
  loginError: null,
  startupSyncReady: false,
};

const store = createStore(initialState);
let bootstrapPromise: Promise<void> | null = null;

function applySessionResponse(response: SessionResponse) {
  const session = response.session;

  store.setState({
    status: session ? "authenticated" : "anonymous",
    currentHandle: session?.currentHandle ?? null,
    authenticatedAt: session?.authenticatedAt ?? null,
    lastValidatedAt: session?.lastValidatedAt ?? null,
    loginError: null,
    startupSyncReady: response.startupSyncReady,
  });
}

export const sessionStore = {
  getState: store.getState,
  subscribe: store.subscribe,
  useStore: store.useStore,
  reset() {
    bootstrapPromise = null;
    store.setState(initialState);
  },
  __setStateForTests(patch: Partial<SessionState>) {
    store.setState((current) => ({
      ...current,
      ...patch,
    }));
  },
  async bootstrap(force = false) {
    if (bootstrapPromise && !force) {
      return bootstrapPromise;
    }

    store.setState((current) => ({
      ...current,
      status: "booting",
      loginError: null,
    }));

    bootstrapPromise = getSession()
      .then((response) => {
        applySessionResponse(response);
      })
      .catch((error) => {
        store.setState({
          ...initialState,
          status: "anonymous",
          loginError: getErrorMessage(error, "Unable to restore the current session."),
        });
      })
      .finally(() => {
        bootstrapPromise = null;
      });

    return bootstrapPromise;
  },
  async refreshSession() {
    try {
      const response = await getSession();
      applySessionResponse(response);
    } catch (error) {
      store.setState((current) => ({
        ...current,
        loginError: getErrorMessage(error, "Unable to refresh the current session."),
      }));
    }
  },
  async login(input: LoginInput) {
    store.setState((current) => ({
      ...current,
      loginError: null,
    }));

    try {
      const response = await loginSession(input);
      applySessionResponse(response);
      return { ok: true as const };
    } catch (error) {
      const message = getErrorMessage(error, "Login failed.");
      store.setState((current) => ({
        ...current,
        status: "anonymous",
        loginError: message,
      }));
      return { ok: false as const, error: message };
    }
  },
  async logout() {
    try {
      await logoutSession();
    } catch {
      // Keep logout local even if the backend is already gone.
    }

    store.setState({
      ...initialState,
      status: "anonymous",
    });
  },
};
