import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { initialState, transition, type Action, type State } from "./model";
import {
  type loadScenario,
  parseState,
  persistState,
  removeMigratedSave,
  ScenarioWriteConflict,
} from "./storage";
export type LoadedScenario = Awaited<ReturnType<typeof loadScenario>>;

function useStore(loaded: LoadedScenario) {
  const [state, setState] = useState(loaded.state);
  const [issue, setIssue] = useState(loaded.issue);
  const [error, setError] = useState("");
  const blocked = useRef(loaded.blocked);
  const latest = useRef(state);
  const stored = useRef(loaded.saved);
  const legacyRaw = useRef(loaded.legacyRaw);
  const pending = useRef(Promise.resolve());

  function commit(change: (current: State) => State, replace = false) {
    const operation = pending.current.then(async () => {
      try {
        const next = change(latest.current);
        if (!blocked.current || replace) {
          try {
            stored.current = await persistState(next, stored.current);
            if (legacyRaw.current !== null) {
              removeMigratedSave(legacyRaw.current);
              legacyRaw.current = null;
            }
            blocked.current = false;
            setIssue("");
          } catch (error) {
            if (error instanceof ScenarioWriteConflict) throw error;
            setIssue((error as Error).message);
          }
        }
        latest.current = next;
        setState(next);
        setError("");
        return true;
      } catch (error) {
        setError(
          error instanceof Error && error.name !== "ZodError"
            ? error.message
            : "Sprawdź poprawność i długość wprowadzonych danych.",
        );
        return false;
      }
    });
    pending.current = operation.then(() => {});
    return operation;
  }
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return {
    state,
    issue,
    error,
    original: loaded.original,
    run: (action: Action) => commit((current) => transition(current, action)),
    importState: (raw: string) => commit(() => parseState(raw), true),
    clearError: () => setError(""),
    reset: () => commit(initialState, true),
  };
}
type Store = ReturnType<typeof useStore>;
const Context = createContext<Store | null>(null);
export function PrototypeProvider({
  loaded,
  children,
}: {
  loaded: LoadedScenario;
  children: ReactNode;
}) {
  const store = useStore(loaded);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function usePrototype() {
  const store = useContext(Context);
  if (!store) throw new Error("PrototypeProvider is required");
  return store;
}
