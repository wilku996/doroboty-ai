import type { Page } from "@playwright/test";
import type { State } from "../../src/features/prototype/model";
import {
  SCENARIO_DATABASE,
  SCENARIO_STORE,
  STORAGE_KEY,
} from "../../src/features/prototype/storage";

export function readScenario(page: Page): Promise<State & { theme?: string }> {
  return page.evaluate(
    ({ database, store, key }) =>
      new Promise<State>((resolve, reject) => {
        const open = indexedDB.open(database);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const connection = open.result;
          const transaction = connection.transaction(store, "readonly");
          const read = transaction.objectStore(store).get(key);
          transaction.oncomplete = () => {
            connection.close();
            const raw = read.result ?? localStorage.getItem(key);
            if (typeof raw !== "string") {
              reject(new Error("The scenario has not been saved."));
              return;
            }
            resolve(JSON.parse(raw));
          };
          transaction.onabort = () => {
            connection.close();
            reject(transaction.error);
          };
        };
      }),
    { database: SCENARIO_DATABASE, store: SCENARIO_STORE, key: STORAGE_KEY },
  );
}
