import { test, expect } from "@playwright/test";
import { initialState, transition } from "../../src/features/prototype/model";
import { STORAGE_KEY } from "../../src/features/prototype/storage";

for (const width of [1280, 390])
  test(`recruiter reopens a closed application at ${width}px`, async ({ page }) => {
    let state = transition(initialState(), { type: "select_person", id: "employer-brightlabs" });
    state = transition(state, {
      type: "stage",
      applicationId: "application-example",
      stage: "rejected",
      note: "Poprzednia decyzja.",
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
      key: STORAGE_KEY,
      state,
    });
    await page.goto("/#/app/kandydaci/application-example");
    await page.reload();
    await expect(page.getByText(/Ponowne otwarcie przywróci etap/)).toBeVisible();
    await page.getByLabel("Notatka rekrutacyjna (widoczna pracodawcy)").fill("Wracamy do rozmowy.");
    await page.getByRole("button", { name: "Otwórz ponownie", exact: true }).press("Enter");
    await expect(page.locator(".record-stage")).toHaveText("W przeglądzie");
    await expect(page.locator(".record-stage")).toBeFocused();
    await expect(page.getByText("Ponownie otwarto · W przeglądzie", { exact: true })).toBeVisible();
    await expect(page.getByText("Poprzednia decyzja.", { exact: true })).toBeVisible();
    await expect(page.getByText("Wracamy do rozmowy.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator(".record-stage")).toHaveText("W przeglądzie");
    await expect(
      page.getByRole("button", { name: "Zaproszenie na rozmowę", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Otwórz ponownie", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: `artifacts/reopened-application-${width}.png`, fullPage: true });
  });
