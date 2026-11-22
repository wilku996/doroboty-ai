import { describe, expect, it } from "vitest";
import { initialState } from "./model";
import {
  MAX_IMPORT_BYTES,
  parseState,
  readState,
  persistState,
  serializeState,
  STORAGE_KEY,
} from "./storage";
function memory(raw: string | null = null) {
  return {
    getItem: (key: string) => (key === STORAGE_KEY ? raw : null),
  };
}
describe("browser persistence and recovery", () => {
  it("round-trips a complete valid scenario", () => {
    const s = initialState();
    expect(readState(memory(serializeState(s))).state).toEqual(s);
    expect(parseState(serializeState(s))).toEqual(s);
  });
  it("protects incompatible/corrupt original saves", () => {
    for (const raw of ["{", JSON.stringify({ ...initialState(), version: 2 })]) {
      const storage = memory(raw);
      const loaded = readState(storage);
      expect(loaded.blocked).toBe(true);
      expect(loaded.original).toBe(raw);
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    }
  });
  it("does not fail startup when storage access is denied", () => {
    expect(readState(null).state.jobs.length).toBeGreaterThan(0);
    expect(
      readState({
        getItem() {
          throw new Error("Denied");
        },
      }).blocked,
    ).toBe(true);
  });
  it("rejects oversized writes before opening storage", async () => {
    const state = initialState();
    state.people[0].bio = "x".repeat(MAX_IMPORT_BYTES);
    await expect(persistState(state, null)).rejects.toThrow("Wyeksportuj");
  });
  it("rejects invalid references and oversized files", () => {
    const s = initialState();
    s.saved = [{ candidateId: "missing", jobId: s.jobs[0].id }];
    expect(() => parseState(JSON.stringify(s))).toThrow("Dotychczasowy stan");
    expect(() => parseState(" ".repeat(MAX_IMPORT_BYTES + 1))).toThrow("za duży");
  });
  it("accepts legacy appearance preferences without changing scenario data", () => {
    const state = initialState();
    for (const theme of ["dark", "system", "light"]) {
      expect(parseState(JSON.stringify({ ...state, theme }))).toEqual(state);
    }
  });
});
