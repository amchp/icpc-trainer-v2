import { useSyncExternalStore } from "react";

type Listener = () => void;
type Updater<T> = T | ((current: T) => T);

export interface StoreApi<T> {
  getState(): T;
  setState(next: Updater<T>): void;
  subscribe(listener: Listener): () => void;
  useStore<U>(selector: (state: T) => U): U;
}

export function createStore<T>(initialState: T): StoreApi<T> {
  let state = initialState;
  const listeners = new Set<Listener>();

  function getState() {
    return state;
  }

  function setState(next: Updater<T>) {
    const value = typeof next === "function" ? (next as (current: T) => T)(state) : next;
    if (Object.is(value, state)) {
      return;
    }

    state = value;
    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function useStore<U>(selector: (value: T) => U) {
    return useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    );
  }

  return {
    getState,
    setState,
    subscribe,
    useStore,
  };
}
