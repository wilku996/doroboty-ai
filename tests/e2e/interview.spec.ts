import { test, expect } from "@playwright/test";

for (const width of [1280, 390, 320]) {
  test(`candidate interview and recruiter report at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 880 });
    await page.goto("/#/auth/sign-in");
    await page.getByRole("button", { name: "Wejdź jako Anna Kowalska" }).click();
    await page.goto("/#/aplikuj/ai-product-manager");
    const applicationAnswer = "Pracowałam przy tworzeniu asystenta do zgłoszeń.";
    await page.getByLabel("Dlaczego pasujesz do tej roli?").fill(applicationAnswer);
    await page.getByRole("button", { name: "Zweryfikuj się" }).press("Enter");
    await expect(
      page.getByRole("heading", {
        name: "Jak przed wdrożeniem sprawdziliście na przykładowych zgłoszeniach, czy model AI nadaje się do wybranego zadania?",
      }),
    ).toBeVisible();
    await page.screenshot({ path: `artifacts/goal-question-${width}.png`, fullPage: true });
    await page.getByLabel("Twoja odpowiedź").fill("Zespół chciał skrócić czas obsługi zgłoszeń.");
    await page.getByRole("button", { name: "Zatwierdź odpowiedź" }).press("Enter");
    await page.reload();
    await expect(page.getByLabel("Dlaczego pasujesz do tej roli?")).toHaveValue(applicationAnswer);
    await page.getByRole("button", { name: "Wznów rozmowę" }).press("Enter");
    await expect(
      page.getByRole("heading", { name: /Jaką instrukcję otrzymywał model AI/ }),
    ).toBeFocused();
    await page.getByLabel("Twoja odpowiedź").fill("Przygotowałam formularz przyjmowania zgłoszeń.");
    await page.getByRole("button", { name: "Zatwierdź odpowiedź" }).click();
    for (let n = 0; n < 3; n++)
      await page.getByRole("button", { name: "Pomiń pytanie" }).press("Enter");
    await page
      .getByRole("checkbox", { name: "Dołącz raport z rozmowy do aplikacji", exact: true })
      .check();
    await page.getByRole("checkbox", { name: /Zatwierdzam treść/ }).check();
    await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
    await page.getByRole("link", { name: "AI Product Manager", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Raport z rozmowy" })).toHaveCount(0);
    const id = page.url().split("/").pop();
    await page.goto("/#/auth/sign-in");
    await page.getByRole("button", { name: "Wejdź jako Karolina Wiśniewska" }).click();
    await page.goto("/#/app/kandydaci/" + id);
    await page.getByRole("tab", { name: "CV", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    const panel = page.getByRole("tabpanel", { name: "Raport z rozmowy" });
    const question = panel.getByText(
      "Jak przed wdrożeniem sprawdziliście na przykładowych zgłoszeniach, czy model AI nadaje się do wybranego zadania?",
      { exact: false },
    );
    await expect(question).toBeVisible();
    const answer = panel.getByText("Zespół chciał skrócić czas obsługi zgłoszeń.", { exact: true });
    expect((await question.boundingBox())!.y).toBeLessThan((await answer.boundingBox())!.y);
    await expect(
      panel.getByText("Przygotowałam formularz przyjmowania zgłoszeń.", { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText(/Sprawdzanie efektu — pytanie pominięte/)).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: "Kontrola przez osobę znającą rolę" }),
    ).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Zapisz kontrolę" })).toHaveCount(0);
    await page.reload();
    await page.getByRole("tab", { name: "Raport z rozmowy" }).click();
    await expect(
      panel.getByText("Przygotowałam formularz przyjmowania zgłoszeń.", { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: `artifacts/interview-report-${width}.png`, fullPage: true });
  });
}

for (const width of [1280, 390]) {
  test(`adaptive conversation skips covered areas and preserves cross-answer evidence at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 880 });
    await page.goto("/#/auth/sign-in");
    await page.getByRole("button", { name: "Wejdź jako Anna Kowalska" }).click();
    await page.goto("/#/aplikuj/ai-product-manager");
    await page
      .getByLabel("Dlaczego pasujesz do tej roli?")
      .fill("Mam doświadczenie w badaniach i wdrażaniu asystenta.");
    await page.getByRole("button", { name: "Zweryfikuj się" }).click();
    await page
      .getByLabel("Twoja odpowiedź")
      .fill(
        "Przed wdrożeniem testowaliśmy model na 40 zgłoszeniach i porównaliśmy wyniki z oczekiwanymi odpowiedziami. Dodałam do instrukcji modelu polecenie: przy braku danych poproś o uzupełnienie. Do kontekstu modelu wybieraliśmy fragmenty dokumentów dopasowane do kategorii zgłoszenia.",
      );
    await page.getByRole("button", { name: "Zatwierdź odpowiedź" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Jak sprawdzaliście, z którego materiału źródłowego pochodzi informacja w odpowiedzi modelu AI?",
      }),
    ).toBeFocused();
    await expect(page.getByText("Twoja wcześniejsza odpowiedź · pytanie 1")).toBeVisible();
    await page.screenshot({ path: `artifacts/adaptive-question-${width}.png`, fullPage: true });
    await page.reload();
    await page.getByRole("button", { name: "Wznów rozmowę" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Jak sprawdzaliście, z którego materiału źródłowego pochodzi informacja w odpowiedzi modelu AI?",
      }),
    ).toBeVisible();
    await page
      .getByLabel("Twoja odpowiedź")
      .fill(
        "Sprawdzaliśmy odpowiedzi modelu, porównując cytat i identyfikator dokumentu źródłowego. Przygotowaliśmy zestaw testowy obejmujący zgłoszenia z brakującymi danymi i nietypowe przypadki. Ocenialiśmy poprawność odpowiedzi przez porównanie z oczekiwanym wzorcem i zapisywaliśmy rozbieżności.",
      );
    await page.getByRole("button", { name: "Zatwierdź odpowiedź" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Opisz konkretny błąd modelu wykryty podczas pracy nad asystentem do zgłoszeń.",
      }),
    ).toBeVisible();
    await page
      .getByLabel("Twoja odpowiedź")
      .fill(
        "Model zmyślał daty. Po wykryciu błędu zmieniliśmy prompt, dodając zakaz dopisywania dat bez źródła.",
      );
    await page.getByRole("button", { name: "Zatwierdź odpowiedź" }).click();
    await expect(page.getByText("Rozmowa zakończona.", { exact: true })).toBeVisible();
    await page
      .getByRole("checkbox", { name: "Dołącz raport z rozmowy do aplikacji", exact: true })
      .check();
    await page.getByRole("checkbox", { name: /Zatwierdzam treść/ }).check();
    await page.getByRole("button", { name: "Wyślij aplikację", exact: true }).click();
    await page.getByRole("link", { name: "AI Product Manager", exact: true }).click();
    const id = page.url().split("/").pop();
    await page.goto("/#/auth/sign-in");
    await page.getByRole("button", { name: "Wejdź jako Karolina Wiśniewska" }).click();
    await page.goto("/#/app/kandydaci/" + id);
    await page.getByRole("tab", { name: "Raport z rozmowy" }).click();
    await expect(
      page.getByText(
        /Odpowiedź pokazuje, że osoba potrafi opisać instrukcję dla AI przy brakujących danych/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Nie oznacza to, że model przestrzegał tej instrukcji", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Znaczenie w pracy", { exact: true })).toHaveCount(0);
    const evidence = page.getByText("Źródła i szczegóły interpretacji", { exact: true }).first();
    await evidence.press("Enter");
    await expect(
      page.getByText("Według odpowiedzi model miał poprosić o uzupełnienie brakujących danych.", {
        exact: true,
      }),
    ).toBeVisible();
    await evidence.press("Enter");
    await page.getByText("Deklarowany własny wkład · rozpoznano opis", { exact: true }).click();
    await expect(
      page.getByText("Własna zmiana instrukcji lub konfiguracji modelu · odpowiedź 1", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByText("Sprawdzanie efektu · rozpoznano opis", { exact: true }).click();
    await expect(
      page.getByText("Przygotowanie przykładów do testowania AI · odpowiedź 2", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Do wyjaśnienia lub kontroli:/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: `artifacts/adaptive-report-${width}.png`, fullPage: true });
  });
}
