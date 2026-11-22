import { initialState, stateSchema, type State } from "./model";
export const STORAGE_KEY = "doroboty.prototype.v1";
export const MAX_IMPORT_BYTES = 2_000_000;
export const SCENARIO_DATABASE = "doroboty.prototype";
export const SCENARIO_STORE = "scenarios";
const WRITE_ERROR =
  "Nie udało się zapisać zmian w przeglądarce. Wyeksportuj dane przed zamknięciem strony.";

export class ScenarioWriteConflict extends Error {
  constructor() {
    super(
      "Inna karta zapisała zmiany. Skopiuj niezapisane treści i odśwież tę kartę, aby wczytać aktualny scenariusz.",
    );
  }
}

export interface StoragePort {
  getItem(key: string): string | null;
}
export function parseState(raw: string): State {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES)
    throw new Error("Plik jest za duży (maksymalnie 2 MB).");
  try {
    return stateSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      "Nieprawidłowy plik lub nieobsługiwana wersja danych. Dotychczasowy stan pozostaje bez zmian.",
    );
  }
}
export function serializeState(state: State) {
  return JSON.stringify(state, null, 2);
}
export function readState(storage: StoragePort | null) {
  if (!storage)
    return {
      state: initialState(),
      issue:
        "Zapis w przeglądarce jest niedostępny. Zmiany zachowasz przez eksport w ustawieniach.",
      blocked: false,
      original: null,
      raw: null,
    };
  try {
    return decodeState(storage.getItem(STORAGE_KEY));
  } catch {
    return unreadableState(null);
  }
}
function decodeState(raw: string | null) {
  try {
    return {
      state: raw ? parseState(raw) : initialState(),
      issue: "",
      blocked: false,
      original: null,
      raw,
    };
  } catch {
    return unreadableState(raw);
  }
}
function unreadableState(raw: string | null) {
  return {
    state: initialState(),
    issue:
      "Nie udało się odczytać zapisu. Dotychczasowe dane nie zostaną nadpisane. Pobierz je w ustawieniach, a następnie zaimportuj poprawny plik lub zresetuj scenariusz.",
    blocked: true,
    original: raw,
    raw,
  };
}
async function scenarioTransaction(replace?: { expectedRaw: string | null; raw: string }) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SCENARIO_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SCENARIO_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    return await new Promise<string | null>((resolve, reject) => {
      const transaction = database.transaction(SCENARIO_STORE, replace ? "readwrite" : "readonly");
      const store = transaction.objectStore(SCENARIO_STORE);
      let raw: string | null = null;
      let conflict = false;
      transaction.oncomplete = () => resolve(raw);
      transaction.onabort = () =>
        reject(conflict ? new ScenarioWriteConflict() : transaction.error);
      const request = store.get(STORAGE_KEY);
      request.onsuccess = () => {
        raw = request.result ?? null;
        if (!replace) return;
        if (raw !== replace.expectedRaw) {
          conflict = true;
          transaction.abort();
          return;
        }
        // Compare and replace the same record in a single read/write transaction.
        store.put(replace.raw, STORAGE_KEY);
      };
    });
  } finally {
    database.close();
  }
}

export async function loadScenario() {
  let legacy: StoragePort | null;
  try {
    legacy = window.localStorage;
  } catch {
    legacy = null;
  }
  const fallback = readState(legacy);
  try {
    const saved = await scenarioTransaction();
    const loaded = saved === null && legacy ? fallback : decodeState(saved);
    return { ...loaded, saved, legacyRaw: fallback.raw };
  } catch {
    return {
      ...fallback,
      issue: fallback.issue || WRITE_ERROR,
      saved: null,
      legacyRaw: fallback.raw,
    };
  }
}

export async function persistState(state: State, expectedRaw: string | null) {
  const raw = serializeState(state);
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES)
    throw new Error("Dane przekraczają 2 MB. Wyeksportuj je, aby zachować zmiany.");
  try {
    await scenarioTransaction({ expectedRaw, raw });
    return raw;
  } catch (error) {
    if (error instanceof ScenarioWriteConflict) throw error;
    throw new Error(WRITE_ERROR);
  }
}

export function removeMigratedSave(raw: string) {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === raw)
      window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The IndexedDB save has already committed, even if legacy cleanup is blocked.
  }
}
