import type { Interview, Sources } from "./interview";
import { aiSkillCoverage } from "./interview-ai-skills";

type Facet = { label: string; ask: string; matches: (text: string) => boolean };
const has = (text: string, ...patterns: RegExp[]) =>
  patterns.every((pattern) => pattern.test(text));
const ai = /\bAI\b|model|asystent|reguł|automatyzac/i;
const cause = /ponieważ|dlatego|bo\b|ze względu|aby\b|żeby|pozwalał|umożliwia|zamiast|ze względu/i;

// Deliberately conservative language rules for the local simulation. A phrase
// is evidence of a declaration only; these checks do not assess work quality.
const facets: Record<string, Facet[]> = {
  goal: [
    {
      label: "Sposób rozpoznania potrzeby",
      ask: "Jak zebrano informacje potrzebne do ustalenia zakresu projektu?",
      matches: (text) =>
        has(
          text,
          /wywiad|rozmow|obserw|ankiet|analiz|warsztat/i,
          /użytkownik|pracownik|konsultant|zgłosze|potrzeb|klient/i,
          /przeprowadzi|rozmawia|obserwowa|analizowa|zebr|pytali|pytał|pytają|pokazali|pokazał/i,
        ),
    },
  ],
  own: [
    {
      label: "Konkretne działanie własne",
      ask: "Jaką konkretną pracę wykonano osobiście przez Ciebie w tym projekcie?",
      matches: (text) =>
        has(
          text,
          /(?:przeprowadzi|przygotowa|zaprojektowa|napisa|zbudowa|wdroży|wybra|ustali|opracowa|analizowa|testowa|odpowiada|sprawdzi|poprawi)ł[ae]m/i,
          /wywiad|rozmow|formularz|badani|test|analiz|kod|integrac|model|prompt|kryteri|prototyp|scenariusz|metryk|warsztat|proces|wybór|zakres|dokument|instrukcj/i,
        ),
    },
  ],
  ai: [
    {
      label: "Zadanie AI",
      ask: "Jaką konkretną czynność wykonywało AI w tym projekcie?",
      matches: (text) =>
        has(
          text,
          ai,
          /(?:klasyfik|porządk|podsumow|wskazyw|generow|wykryw|uzupełni|odczytyw|proponow|wyszukiw|przetwarz|grupow|analizow|tworzy|rozpoznaw|sortow|streszcza|odpowiada)\S*|nie (?:używaliśmy|używałam|używałem|wykorzystaliśmy|stosowaliśmy) AI/i,
        ),
    },
    {
      label: "Powód wyboru podejścia",
      ask: "Co przesądziło o wyborze tego sposobu wykorzystania AI?",
      matches: (text) =>
        has(text, ai, cause, /wybr|wybór|zastos|uży|wykorzyst|zrezygn|stosow|postaw|potrzeb/i),
    },
  ],
  effect: [
    {
      label: "Sposób sprawdzania wyniku",
      ask: "Jak konkretnie sprawdzono, czy wynik projektu był poprawny?",
      matches: (text) =>
        has(
          text,
          /porówn|mierzy|zmierzy|sprawdz|ocen|testowa|walidowa/i,
          /wynik|czas|odpowiedzi|zgłosze|poprawn|jakoś|błęd|trafnoś/i,
          /\d|przed.{0,80}po |ręczn|ekspert|zestaw|prób[akc]|zbior|oczekiwan/i,
        ),
    },
  ],
  limits: [
    {
      label: "Konkretny błąd lub ograniczenie",
      ask: "Jaki konkretny błąd albo ograniczenie pojawiło się w projekcie?",
      matches: (text) =>
        has(
          text,
          /model|asystent|system|rozwiązan|projekt|odpowied|wynik|dane/i,
          /błęd|pomył|mylił|pomijał|gubił|nie rozpoznawał|nie radził|nie działał|zmyślał|ograniczen|niepopraw|halucyn/i,
        ),
    },
    {
      label: "Sposób postępowania z ograniczeniem",
      ask: "Jak zareagowano na opisany błąd lub ograniczenie?",
      matches: (text) =>
        has(
          text,
          /błęd|pomył|ograniczen|kontrol|weryfik|sprawdz|niepewn|brak.{0,20}danych/i,
          /dodali|dodał|wprowadzili|wprowadził|poprawili|poprawił|wyłączyli|wyłączył|przekaz|kierowa|odrzuca|zatrzymywa|ręczn|człowiek|operator/i,
        ),
    },
  ],
};

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Keep the first policy above for validating saved sequences. New conversations
// select the unknown detail, not a headline that the CV already supplies.
function detailedFacets(sources: Sources): Record<string, Facet[]> {
  const cv = sentences(sources.cv);
  const known = (facet: Facet) => cv.some((text) => facet.matches(text));
  const result = Object.fromEntries(
    Object.entries(facets).map(([id, details]) => [id, details.map((detail) => ({ ...detail }))]),
  );
  const study = sources.cv.match(/badania z (\d+) użytkownikami/i);
  result.goal[0].ask =
    study && /asystenta do zgłoszeń/i.test(sources.cv)
      ? `W CV wspominasz o badaniach z ${study[1]} użytkownikami. Jak przeprowadziłaś te badania, żeby ustalić, w czym asystent miał im pomagać?`
      : /projekt|wdroż|automatyz|zbudow|opracowa|stworzy/i.test(sources.cv)
        ? "Jak zebrano informacje potrzebne do ustalenia zakresu projektu opisanego w CV?"
        : "Wybierz własny projekt związany z tą ofertą. Jak zebrano informacje potrzebne do ustalenia jego zakresu?";
  if (known(facets.goal[0]))
    result.goal = [
      {
        label: "Dobór przypadków do rozpoznania potrzeby",
        ask: "W CV opisujesz sposób rozpoznania potrzeb. Jak dobrano osoby lub przypadki do tego badania?",
        matches: (text) =>
          has(
            text,
            /dobr|wybr|zapros|rekrut|uwzględni/i,
            /osob|użytkownik|pracownik|klient|przypad|zgłosze/i,
            /różn|każd|losow|kryteri|doświadcze|staż|typ|dział|często|now|aktywn/i,
          ),
      },
    ];
  result.own = [
    {
      label: "Konkretny przykład własnego działania lub decyzji",
      ask:
        /priorytetyzac/i.test(sources.cv) && /asystenta do zgłoszeń/i.test(sources.cv)
          ? "W CV wymieniasz priorytetyzację. Jaką decyzję o zakresie pierwszej wersji asystenta podjęłaś osobiście?"
          : "Opisz na konkretnym przykładzie, jak wykonano jeden krok projektu, za który odpowiadasz osobiście.",
      matches: (text) =>
        (facets.own[0].matches(text) &&
          /wywiad|obserw|który|która|które|zawiera|zamiast|tylko|wyklucz|odrzuc|usun|ogranicz|pola|kryteri|scenariusz|prompt|kod|integrac/i.test(
            text,
          )) ||
        has(
          text,
          /wybrał[ae]m|zdecydował[ae]m|ustalił[ae]m|ograniczył[ae]m|odrzucił[ae]m/i,
          /klasyfik|generow|podsumow|zakres|tylko|zamiast|pierwsz|wersj|funkcj/i,
        ),
    },
  ];
  if (known(result.own[0]))
    result.own = [
      {
        label: "Uzasadnienie sposobu pracy własnej",
        ask: "Co przesądziło o sposobie wykonania opisanej w CV pracy własnej?",
        matches: (text) =>
          has(text, cause, /wybrał[ae]m|zdecydował[ae]m|zastosował[ae]m|użył[ae]m|zrobił[ae]m/i),
      },
    ];
  result.ai[0].ask =
    "Na przykładzie jednego przypadku opisz rolę AI lub sposób wykonania zadania bez niego.";
  // A known task or reason provides context, not evidence of candidate skill.
  // Ask only the other part; if both are given, ask about the trade-off.
  result.ai = result.ai.filter((_, index) => !known(facets.ai[index]));
  if (!result.ai.length)
    result.ai = [
      {
        label: "Porównanie podejść",
        ask: "W CV opisujesz zastosowanie AI i powód wyboru. Jak oceniono możliwość wykonania tego samego zadania prostszą metodą?",
        matches: (text) =>
          has(
            text,
            /porówn|sprawdz|testowa|odrzuc|rozważ/i,
            /reguł|ręczn|skrypt|szablon|bez AI|prosts|alternatyw/i,
            /ponieważ|bo\b|wynik|czas|błęd|koszt|jakoś|trafnoś/i,
          ),
      },
    ];
  const metric = sources.cv.match(/\d+(?:[.,]\d+)?\s*%/)?.[0];
  result.effect[0].ask = metric
    ? `Jak wykonano pomiar, z którego pochodzi podany w CV wynik ${metric}?`
    : "Opisz sposób sprawdzenia wyniku projektu na konkretnym przykładzie.";
  if (known(facets.effect[0]))
    result.effect = [
      {
        label: "Wiarygodność pomiaru",
        ask: "W CV opisujesz pomiar wyniku. Jak sprawdzono, czy porównywane przypadki pozwalały na miarodajne porównanie?",
        matches: (text) =>
          has(
            text,
            /sprawdz|dobr|porówn|kontrol|wybr/i,
            /prób|przypad|zgłosze|okres|grup/i,
            /podobn|różn|porównywal|jednakow|losow|typ|trudnoś/i,
          ),
      },
    ];
  result.limits[0].ask =
    "Opisz konkretną sytuację, w której rozwiązanie nie zadziałało zgodnie z oczekiwaniami.";
  result.limits[0].matches = (text) =>
    has(
      text,
      /model|asystent|system|rozwiązan|projekt|odpowied|wynik|dane/i,
      /mylił|pomijał|gubił|nie rozpoznawał|nie radził|nie działał|zmyślał|(?:zwraca|podawa|generowa|klasyfikowa)\S* .{0,40}(?:błęd|niepopraw)/i,
    );
  const problemInCv = known(result.limits[0]);
  result.limits = result.limits.filter((detail) => !known(detail));
  if (result.limits.length === 1 && problemInCv)
    result.limits[0].ask = "Jak zareagowano na błąd lub ograniczenie opisane w CV?";
  if (!result.limits.length)
    result.limits = [
      {
        label: "Sprawdzenie poprawki",
        ask: "W CV opisujesz problem i reakcję na niego. Jak sprawdzono, czy ta zmiana pomogła?",
        matches: (text) =>
          has(
            text,
            /sprawdz|testowa|porówn|zmierzy/i,
            /popraw|zmian|błęd|pomył/i,
            /prób|przypad|zestaw|ponown|przed|po |\d/i,
          ),
      },
    ];
  return result;
}

export function topicCoverage(interview: Interview) {
  if (interview.aiFrom !== undefined && interview.turns.length >= interview.aiFrom)
    return aiSkillCoverage(interview);
  const detailed =
    interview.detailFrom !== undefined && interview.turns.length >= interview.detailFrom;
  const cv = normalize(interview.sources.cv);
  const excerpts = interview.turns.flatMap((turn, index) =>
    sentences(turn.reply ?? "")
      .filter(
        (text) =>
          (!detailed || !cv.includes(normalize(text))) &&
          !/nie (?:pamiętam|wiem|potrafię|znam|przeprowadzi|przygotowa|zaprojektowa|napisa|zbudowa|wdroży|analizowa|testowa|sprawdzi|porówn|mierzy|zmierzy)|nie mam|brak informacji|przykładowo|hipotetycz|gdybym|zrobił[ab]ym/i.test(
            text,
          ),
      )
      .map((text) => ({ text, turn: index + 1 })),
  );
  const selected = detailed ? detailedFacets(interview.sources) : facets;
  if (
    detailed &&
    excerpts.some(({ text }) =>
      /nie (?:używaliśmy|używałam|używałem|wykorzystaliśmy|stosowaliśmy) AI/i.test(text),
    )
  ) {
    const reason = selected.ai.find((detail) => detail.label === "Powód wyboru podejścia");
    if (reason) reason.ask = "Dlaczego zdecydowano się wykonać to zadanie bez AI?";
  }
  return Object.entries(selected).map(([id, details]) => {
    const facts = details.flatMap((detail) => {
      const match = excerpts.find((excerpt) => detail.matches(excerpt.text));
      return match ? [{ ...match, label: detail.label }] : [];
    });
    const missing = details.filter((detail) => !facts.some((fact) => fact.label === detail.label));
    return { id, facts, missing, covered: missing.length === 0 };
  });
}
