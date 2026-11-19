import { test, expect } from "@playwright/test";
import { initialState, transition } from "../../src/features/prototype/model";
import { nextQuestion } from "../../src/features/prototype/interview";
import { STORAGE_KEY } from "../../src/features/prototype/storage";

function scenario() {
  let state = transition(initialState(), { type: "select_person", id: "candidate-anna" });
  const jobId = state.jobs[0].id;
  const answer = "Syntetyczny opis mojego projektu AI.";
  state = transition(state, { type: "interview_start", jobId, answer });
  const replies = [
    "Sprawdziłam powtarzalne zadania.",
    "Wysłał sprawę do człowieka.",
    "Model analizował treść.",
    "Dublowaliśmy zgłoszenia, opisywaliśmy przeczące sobie rzeczy.",
    "Źle zinterpretował dane, które przeczyły sobie.",
  ];
  while (nextQuestion(state.drafts[0].interview!)) {
    const i = state.drafts[0].interview!;
    state = transition(state, {
      type: "interview_reply",
      jobId,
      answer,
      questionId: nextQuestion(i)!.id,
      position: i.turns.length,
      reply: replies[i.turns.length] ?? null,
    });
  }
  state = transition(state, {
    type: "submit",
    jobId,
    answer,
    notes: "",
    generated: "",
    consent: true,
    includeReport: true,
  });
  const applicationId = state.applications.at(-1)!.id;
  state = transition(state, { type: "select_person", id: "employer-brightlabs" });
  state = transition(state, {
    type: "stage",
    applicationId,
    stage: "rejected",
    note: "Zakończono proces.",
  });
  return { state, applicationId };
}

for (const width of [1280, 390])
  test(`preview and approve optional test before invitation at ${width}px`, async ({ page }) => {
    const { state, applicationId } = scenario();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
      key: STORAGE_KEY,
      state,
    });
    await page.goto("/#/app/kandydaci/" + applicationId);
    await page.reload();
    await page.getByRole("tab", { name: "Raport z rozmowy" }).click();
    const panel = page.getByRole("region", { name: "Dodatkowy test A–D", exact: true });
    await expect(panel.getByRole("heading", { name: "Podgląd pytania 1" })).toBeVisible();
    await expect(
      panel.getByText("B. Wskaż brak numeru i poproś o jego uzupełnienie.", { exact: true }),
    ).toBeVisible();
    const invite = panel.getByRole("button", { name: "Zaproś do krótkiego testu" });
    await expect(invite).toBeEnabled();
    await expect(panel.getByText("Kontrola przed zaproszeniem", { exact: true })).toHaveCount(0);
    await expect(panel.getByLabel("Osoba znająca rolę, która sprawdziła test")).toHaveCount(0);
    await expect(panel.getByRole("checkbox", { name: /Sprawdzono treść/ })).toHaveCount(0);
    await panel
      .getByText("Klucz i poprawki · tylko rekruter", { exact: true })
      .first()
      .press("Enter");
    const question = panel.getByRole("textbox", { name: "Treść pytania 1", exact: true });
    const revised = (await question.inputValue()) + " Wybierz jedną odpowiedź.";
    await question.fill(revised);
    await panel.getByRole("combobox", { name: "Klucz · pytanie 1", exact: true }).selectOption("B");
    await panel.getByRole("checkbox", { name: "Uwzględnij pytanie 2 w teście" }).uncheck();
    expect(
      await page.evaluate(
        ({ key, id }) =>
          JSON.parse(localStorage.getItem(key)!).applications.find(
            (a: { id: string }) => a.id === id,
          ).optionalTest,
        { key: STORAGE_KEY, id: applicationId },
      ),
    ).toBeUndefined();
    await expect(invite).toBeEnabled();
    await page.screenshot({ path: `artifacts/optional-test-preview-${width}.png`, fullPage: true });
    await invite.click();
    await page.reload();
    await page.getByRole("tab", { name: "Raport z rozmowy" }).click();
    await expect(panel.getByText(/Zaproszenie do testu zapisane/)).toBeVisible();
    await page.goto("/#/auth/sign-in");
    await page.getByRole("button", { name: "Wejdź jako Anna Kowalska" }).click();
    await page.goto("/#/app/aplikacje/" + applicationId);
    const candidate = page.getByRole("region", { name: "Zaproszenie do krótkiego testu" });
    await expect(candidate.getByRole("group")).toHaveCount(2);
    await expect(candidate.getByText(/Klucz:|Poprawna odpowiedź:/)).toHaveCount(0);
    await expect(candidate.getByRole("group").first()).toContainText(revised);
    await candidate
      .getByRole("radio", { name: "B. Wskaż brak numeru i poproś o jego uzupełnienie." })
      .check();
    await page.reload();
    await expect(
      candidate.getByRole("radio", { name: "B. Wskaż brak numeru i poproś o jego uzupełnienie." }),
    ).toBeChecked();
    await candidate.getByRole("button", { name: "Prześlij odpowiedzi do testu" }).click();
    await expect(candidate.getByText(/1 poprawna odpowiedź z 1 ocenianej/)).toBeVisible();
    await expect(candidate.getByText(/Wszystkie zadane pytania: 2/)).toBeVisible();
    await page.goto("/#/auth/sign-in");
    await page.getByRole("button", { name: "Wejdź jako Karolina Wiśniewska" }).click();
    await page.goto("/#/app/kandydaci/" + applicationId);
    await page.getByRole("tab", { name: "Raport z rozmowy" }).click();
    await expect(panel.getByText(/1 poprawna odpowiedź z 1 ocenianej/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
