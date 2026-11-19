import type { Interview } from "./interview";

type Detail = { label: string; ask: string; matches: (text: string) => boolean };
const has = (text: string, ...patterns: RegExp[]) => patterns.every((p) => p.test(text));
const split = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Finite, explicit local simulation. These rules recognize descriptions, not
// competence. Missing evidence remains a gap in the report.
export function aiSkillCoverage(interview: Interview) {
  const cv = interview.sources.cv;
  const ticketAssistant = /asystent/i.test(cv) && /zgłosze/i.test(cv);
  const context = ticketAssistant ? "asystentem do zgłoszeń" : "rozwiązaniem AI";
  const details: Record<string, Detail[]> = {
    goal: [
      {
        label: "Sprawdzenie przydatności AI do zadania",
        ask: ticketAssistant
          ? "Jak przed wdrożeniem sprawdziliście na przykładowych zgłoszeniach, czy model AI nadaje się do wybranego zadania?"
          : "Wybierz projekt związany z tą ofertą. Jak sprawdzono na przykładach, czy AI nadaje się do wybranego zadania?",
        matches: (text) =>
          has(
            text,
            /AI|model|asystent/i,
            /sprawdz|test|prób|pilot/i,
            /zgłosze|przypad|przykład|zada/i,
            /porówn|oczekiwan|ręczn|ekspert|poprawn/i,
          ),
      },
    ],
    own: [
      {
        label: "Instrukcja modelu przy brakujących danych",
        ask: "Jaką instrukcję otrzymywał model AI na sytuację, gdy w zgłoszeniu brakowało informacji potrzebnych do przygotowania odpowiedzi?",
        matches: (text) =>
          has(
            text,
            /instrukcj|prompt|model/i,
            /brak|niepełn|nie ma|nie miał|nie zna/i,
            /dopyt|popro|odm[óo]w|wstrzym|zwr[óo]c|oznacz|nie (?:odpowiad|gener|dopisu|zmyśl)/i,
          ),
      },
      {
        label: "Własna zmiana instrukcji lub konfiguracji modelu",
        ask: "Opisz jedną własną zmianę w instrukcji lub konfiguracji modelu AI.",
        matches: (text) =>
          has(
            text,
            /(?:doda|zmieni|napisa|przygotowa|ustawi|usun[ęą]|wprowadzi)ł[ae]m/i,
            /instrukcj|prompt|model|temperatur|konfigur/i,
            /dopyt|brak|zwr[óo]c|cyt|źród|format|JSON|przykład|nie (?:dopisu|zmyśl|gener)|\d/i,
          ),
      },
    ],
    ai: [
      {
        label: "Dobór informacji dla modelu",
        ask: "Jak wybieraliście informacje przekazywane modelowi AI do przygotowania odpowiedzi?",
        matches: (text) =>
          has(
            text,
            /model|AI|kontekst|prompt/i,
            /wybier|wybra|dobier|dobr|filtrow|wyszuk|pobier|przekazyw/i,
            /baz|dokument|artykuł|histori|pole|fragment/i,
            /temat|kategori|podobień|aktual|uprawnie|identyfik|dopas|limit|tylko/i,
          ),
      },
      {
        label: "Sprawdzenie źródła informacji modelu",
        ask: "Jak sprawdzaliście, z którego materiału źródłowego pochodzi informacja w odpowiedzi modelu AI?",
        matches: (text) =>
          has(
            text,
            /odpowied|model/i,
            /źród|dokument|artykuł/i,
            /cytat|cytowa|identyfik|odnośnik|link|numer|fragment/i,
            /sprawdz|porówn|weryfik/i,
          ),
      },
    ],
    effect: [
      {
        label: "Przygotowanie przykładów do testowania AI",
        ask: "Jak przygotowaliście przykłady testowe pozwalające wykryć niepoprawne odpowiedzi modelu AI?",
        matches: (text) =>
          has(
            text,
            /test|ocen|ewaluac/i,
            /przykład|przypad|zgłosze|zestaw/i,
            /dobr|wybr|zebr|przygot|uwzględni/i,
            /brak|trudn|nietyp|różn|błęd|kategori|oczekiwan/i,
          ),
      },
      {
        label: "Ocena poprawności odpowiedzi AI",
        ask: "Po czym w testach rozpoznawaliście, że odpowiedź modelu AI jest poprawna?",
        matches: (text) =>
          has(
            text,
            /odpowied|wynik/i,
            /porówn|ocen|sprawdz|weryfik/i,
            /wzorc|oczekiwan|referenc|fakt|źródł|ekspert/i,
            /zgodn|rozbież|błęd|poprawn|punkt|kryteri/i,
          ),
      },
    ],
    limits: [
      {
        label: "Konkretny błąd modelu AI",
        ask: `Opisz konkretny błąd modelu wykryty podczas pracy nad ${context}.`,
        matches: (text) =>
          has(
            text,
            /model|asystent|AI/i,
            /mylił|pomijał|gubił|zmyślał|nie rozpoznawał|(?:zwraca|generowa|podawa)\S* .{0,40}(?:błęd|niepopraw)/i,
          ),
      },
      {
        label: "Zmiana po wykryciu błędu AI",
        ask: "Jaką zmianę wprowadziliście w rozwiązaniu AI po wykryciu tego błędu?",
        matches: (text) =>
          has(
            text,
            /zmieni|dodali|dodał|poprawi|usun|wyłącz|wprowadzi/i,
            /prompt|instrukcj|model|kontekst|wyszuk|walidac|test/i,
            /błęd|dat|kwot|źród|brak|cyt|format|przykład|nie (?:gener|zmyśl|dopisu)/i,
            /po (?:wykry|błęd|pomył)|napraw|poprawk|żeby (?:usun|wyelimin)/i,
          ),
      },
    ],
  };
  if (!ticketAssistant)
    details.own[0].ask =
      "Jaką instrukcję otrzymywał model AI, gdy brakowało danych potrzebnych do wykonania zadania?";
  const excerpts = interview.turns.flatMap((turn, index) =>
    split(isSituationalQuestion(turn.question) ? "" : (turn.reply ?? ""))
      .filter(
        (text) =>
          !normalize(cv).includes(normalize(text)) &&
          !/nie (?:wiem|pamiętam|potrafię|znam|sprawdz|testowa|przygotowa|doda|zmieni)|brak informacji|hipotetycz|gdybym|zrobił[ab]ym/i.test(
            text,
          ),
      )
      .map((text) => ({ text, turn: index + 1 })),
  );
  return Object.entries(details).map(([id, catalog]) => {
    const unknown = catalog.filter((detail) => !split(cv).some(detail.matches));
    const facts = unknown.flatMap((detail) => {
      const match = excerpts.find(({ text }) => detail.matches(text));
      return match ? [{ ...match, label: detail.label }] : [];
    });
    const missing = unknown.filter((detail) => !facts.some((fact) => fact.label === detail.label));
    return { id, facts, missing, covered: unknown.length > 0 && missing.length === 0 };
  });
}

export function isSituationalQuestion(question?: string) {
  return question?.startsWith("Zadanie sytuacyjne") ?? false;
}

// Replacement basics ask about another skill; they do not imply that a practice
// occurred. Scenarios are explicitly hypothetical and excluded from work evidence.
const replacementDetails: Record<string, Detail[]> = {
  goal: [
    {
      label: "Warunek zatrzymania wdrożenia AI",
      ask: "Jak ustalano, które błędy AI wykluczają wdrożenie rozwiązania?",
      matches: (t) => has(t, /błęd|pomył/i, /wyklucz|zatrzym|rezygn|próg|niedopuszcz/i),
    },
  ],
  own: [
    {
      label: "Sprawdzenie własnej zmiany instrukcji",
      ask: "Jak sprawdzono wpływ Twojej zmiany instrukcji na odpowiedzi modelu AI?",
      matches: (t) => has(t, /instrukcj|prompt/i, /zmian|popraw/i, /porówn|sprawdz|test/i),
    },
  ],
  ai: [
    {
      label: "Ograniczanie danych poufnych dla AI",
      ask: "Jak ograniczaliście przekazywanie poufnych danych do modelu AI?",
      matches: (t) =>
        has(t, /dan|informac/i, /poufn|osobow/i, /mask|anonim|usuwa|filtrow|ogranicz/i),
    },
  ],
  effect: [
    {
      label: "Oddzielenie przykładów do poprawiania i oceny AI",
      ask: "Jak oddzielaliście przykłady używane do poprawiania AI od przykładów do końcowej oceny?",
      matches: (t) =>
        has(
          t,
          /przykład|zestaw|zbiór|danych/i,
          /oddziel|osobn|podział|niewykorzyst|niezależn/i,
          /test|ocen|popraw/i,
        ),
    },
  ],
  limits: [
    {
      label: "Wykrywanie pogorszenia działania AI",
      ask: "Jak wykrywaliście pogorszenie odpowiedzi AI po uruchomieniu rozwiązania?",
      matches: (t) =>
        has(t, /monitor|alarm|przegląd|regularn/i, /odpowied|model|AI/i, /błęd|jakoś|pogorsz/i),
    },
  ],
};
const situations: Record<string, string> = {
  goal: "Model poprawnie obsługuje 18 z 20 przypadków, ale w dwóch pozostałych podaje błędną kwotę. Jakiej dodatkowej informacji potrzebujesz do decyzji o pilotażu?",
  own: "Model ma zwracać wyłącznie kategorię zgłoszenia, ale dopisuje wyjaśnienia. Jaką pojedynczą zmianę instrukcji zaproponujesz?",
  ai: "Model ma dostęp do dwóch instrukcji o sprzecznej treści i nie zna dat ich aktualizacji. Jak powinien postąpić przed przygotowaniem odpowiedzi?",
  effect:
    "Wynik testu wzrósł z 80% do 95%, ale z zestawu usunięto trudne przypadki. Jak sprawdzisz, czy model rzeczywiście się poprawił?",
  limits:
    "Po zmianie modelu liczba błędnych odpowiedzi rośnie, chociaż instrukcja jest ta sama. Jaki pierwszy krok diagnostyczny wybierzesz?",
};

export function replacementBasic(interview: Interview, topic: string) {
  const known = [interview.sources.cv, ...interview.turns.map((turn) => turn.reply ?? "")].join(
    "\n",
  );
  const detail = replacementDetails[topic]?.find(
    (item) =>
      !split(known).some(item.matches) &&
      !interview.turns.some((turn) => turn.question === item.ask),
  );
  return (
    detail?.ask ??
    `Zadanie sytuacyjne dla roli „${interview.sources.title}” (nie opis Twojego projektu): ${situations[topic]}`
  );
}
