import { createStore } from "../lib/store";

export type UpsolvingTabId = "gyms" | "contests";

export interface Notice {
  id: string;
  message: string;
}

interface UiState {
  activeUpsolvingTab: UpsolvingTabId;
  lastSelectedContestId: number | null;
  notices: Notice[];
}

const initialState: UiState = {
  activeUpsolvingTab: "gyms",
  lastSelectedContestId: null,
  notices: [],
};

const store = createStore(initialState);

export const uiStore = {
  getState: store.getState,
  subscribe: store.subscribe,
  useStore: store.useStore,
  reset() {
    store.setState(initialState);
  },
  setActiveUpsolvingTab(tab: UpsolvingTabId) {
    store.setState((current) => ({
      ...current,
      activeUpsolvingTab: tab,
    }));
  },
  setLastSelectedContestId(contestId: number | null) {
    store.setState((current) => ({
      ...current,
      lastSelectedContestId: contestId,
    }));
  },
  pushNotice(notice: Notice) {
    store.setState((current) => ({
      ...current,
      notices: [...current.notices, notice],
    }));
  },
  dismissNotice(id: string) {
    store.setState((current) => ({
      ...current,
      notices: current.notices.filter((notice) => notice.id !== id),
    }));
  },
};
