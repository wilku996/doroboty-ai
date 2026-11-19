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
// competence. An exhausted catalog leaves a gap instead of inventing a question.
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
    split(turn.reply ?? "")
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
