import { useSyncExternalStore } from "react";

// A small shared state container: components that call use() re-render after every update()
export function createStore(state) {
  const listeners = new Set();
  let version = 0;
  const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
  const getVersion = () => version;
  return {
    state,
    update(change) {
      if (typeof change === "function") change(state);
      else if (change) Object.assign(state, change);
      version++;
      listeners.forEach((l) => l());
    },
    subscribe,
    use() {
      useSyncExternalStore(subscribe, getVersion);
      return state;
    },
  };
}
