import { useState, useEffect } from "react";

// Persist state to localStorage so filters/date ranges survive page navigation & reload.
export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [key, state]);

  return [state, setState];
}
