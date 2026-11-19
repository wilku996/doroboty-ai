import type { Sources } from "./interview";

type Rule = {
  matches: (text: string) => boolean;
  summary: string;
  relevance: string;
  limit: string;
  skill: string;
  boundary: string;
  role: RegExp;
  evidenceLabels?: string[];
};
const has = (text: string, ...patterns: RegExp[]) => patterns.every((p) => p.test(text));
const rules: Rule[] = [
  {
    matches: (t) =>
      has(t, /powtarzal|powtarzając/i, /czas|czasochłon/i, /sprawdzi|analiz|ustal|szuka/i),
    summary:
      "Osoba opisuje szukanie powtarzalnych i czasochłonnych czynności, które warto usprawnić.",
    skill: "wskazać powtarzalną pracę do usprawnienia",
    boundary: "potrafi uzasadnić wybór AI do tego zadania",
    relevance:
      "Taki opis pomaga zrozumieć, jak wybierano problem do rozwiązania i gdzie automatyzacja mogłaby być przydatna.",
    limit:
      "Samo wskazanie czasochłonnej pracy nie potwierdza jeszcze, że AI było odpowiednim rozwiązaniem.",
    role: /problem|proces|potrzeb/i,
  },
  {
    matches: (t) =>
      has(t, /wysła|wysyła|przekaz|kierowa/i, /człowiek|człowieka|operator|konsultant/i),
    summary: "Według odpowiedzi wybrane sprawy trafiały do człowieka do oceny.",
    skill: "opisać przekazywanie spraw od AI do człowieka",
    boundary: "potrafi ustalić, które sprawy wymagają takiej kontroli",
    relevance:
      "To sposób na pozostawienie człowiekowi kontroli nad sprawami obsługiwanymi przez AI.",
    limit:
      "Samo przekazanie sprawy człowiekowi nie potwierdza, że wykrywano wszystkie błędy ani że osoba aplikująca zaprojektowała tę zasadę.",
    role: /kontrol|błęd|wyjątk|weryfik|odpowiedzial/i,
  },
  {
    matches: (t) => has(t, /powtarzal/i, /instrukcj/i, /skomplikowan|złożon/i),
    summary:
      "Osoba opisuje dwa sposoby obsługi: gotowe instrukcje dla powtarzalnych zgłoszeń i analizę bardziej złożonych spraw.",
    skill: "opisać różne sposoby obsługi prostych i złożonych spraw przez AI",
    boundary: "model poprawnie rozróżniał te sprawy",
    relevance:
      "Rozróżnienie prostych i trudniejszych spraw może pomóc ustalić zakres automatyzacji.",
    limit: "Ten opis podziału nie pokazuje jeszcze, czy model poprawnie rozpoznawał rodzaj sprawy.",
    role: /proces|automat|model/i,
  },
  {
    matches: (t) =>
      has(
        t,
        /dublowaliśmy|dublowałyśmy|powielaliśmy|powielałyśmy|testowa|przygotowa/i,
        /dublowa|powiel|powtórzon/i,
        /sprzeczn|przecząc/i,
      ),
    summary: "Osoba opisuje testowanie AI na powtórzonych zgłoszeniach i sprzecznych informacjach.",
    skill: "wskazać powtórzenia i sprzeczne dane jako przypadki do testowania AI",
    boundary: "potrafi ocenić wyniki tych testów",
    relevance:
      "Takie przypadki mogą ujawnić błędy, których nie widać przy prostych, spójnych danych.",
    limit:
      "Opis przygotowania takich przypadków sam w sobie nie mówi, czy system przeszedł testy ani jak oceniano jego odpowiedzi.",
    role: /sprawdz|test|pilotaż|porówna/i,
    evidenceLabels: ["Przygotowanie przykładów do testowania AI"],
  },
  {
    matches: (t) =>
      has(
        t,
        /test|zestaw/i,
        /przygot|zebr|dobr|wybr/i,
        /przykład|przypad|zgłosze/i,
        /brak|nietyp|trudn/i,
      ),
    summary:
      "Osoba opisuje przygotowanie trudniejszych przykładów do sprawdzania AI, a nie tylko typowych, łatwych przypadków.",
    skill: "wskazać trudne przypadki do testowania AI",
    boundary: "testy objęły wszystkie istotne sytuacje",
    relevance:
      "Pozwala to szukać sytuacji, w których rozwiązanie może zawieść podczas codziennej pracy.",
    limit:
      "Sam zestaw przykładów nie potwierdza poprawności rozwiązania ani tego, że obejmuje wszystkie ważne sytuacje.",
    role: /sprawdz|test|pilotaż|błęd/i,
    evidenceLabels: ["Przygotowanie przykładów do testowania AI"],
  },
  {
    matches: (t) => has(t, /instrukcj|prompt|model/i, /brak|niepełn/i, /popro|dopyt/i),
    summary: "Według odpowiedzi model miał poprosić o uzupełnienie brakujących danych.",
    skill: "opisać instrukcję dla AI przy brakujących danych",
    boundary: "model przestrzegał tej instrukcji",
    relevance: "Taka instrukcja może ograniczać odpowiadanie na podstawie niepełnych informacji.",
    limit:
      "Zapisanie instrukcji nie dowodzi, że model zawsze jej przestrzegał; do tego potrzebne są wyniki sprawdzenia jego zachowania.",
    role: /model|AI|kontrol|błęd/i,
    evidenceLabels: ["Instrukcja modelu przy brakujących danych"],
  },
  {
    matches: (t) =>
      has(t, /(?:doda|zmieni|napisa|przygotowa|ustawi)ł[ae]m/i, /prompt|instrukcj|konfigur/i),
    summary: "Osoba deklaruje własną pracę nad poleceniami lub ustawieniami modelu AI.",
    skill: "wskazać swój deklarowany wkład w instrukcje lub ustawienia AI",
    boundary: "samodzielne wykonanie tej pracy zostało potwierdzone",
    relevance:
      "To bardziej konkretny opis udziału w projekcie niż samo stwierdzenie, że zespół wdrożył AI.",
    limit:
      "Jest to deklaracja własnego wkładu; rozmowa nie potwierdza niezależnie wykonania tej pracy ani jej jakości.",
    role: /współprac|model|AI/i,
  },
  {
    matches: (t) =>
      has(
        t,
        /model|kontekst/i,
        /wybier|wybra|dobier|filtrow|wyszuk/i,
        /dokument|fragment|artykuł/i,
        /kategori|temat|dopas/i,
      ),
    summary: "Według odpowiedzi model dostawał wybrane fragmenty materiałów dopasowane do sprawy.",
    skill: "opisać dobór materiałów dla AI do konkretnej sprawy",
    boundary: "materiały były kompletne i aktualne",
    relevance:
      "Dobór takich materiałów wpływa na to, na jakich informacjach AI może oprzeć odpowiedź.",
    limit:
      "Ten opis nie dowodzi, że wybrane materiały były kompletne i aktualne ani że model poprawnie z nich korzystał.",
    role: /dokument|model|danych/i,
    evidenceLabels: ["Dobór informacji dla modelu"],
  },
  {
    matches: (t) =>
      has(
        t,
        /sprawdz|porówn|weryfik/i,
        /odpowied|model/i,
        /cytat|identyfikator|odnośnik/i,
        /dokument|źród/i,
      ),
    summary: "Osoba opisuje sprawdzanie, z jakiego materiału pochodzi informacja podana przez AI.",
    skill: "opisać sprawdzanie źródła informacji podanej przez AI",
    boundary: "sama obecność źródła potwierdza poprawność odpowiedzi AI",
    relevance:
      "Pozwala to szukać odpowiedzi, które brzmią wiarygodnie, ale nie mają oparcia w materiałach.",
    limit:
      "Samo wskazanie źródła nie oznacza, że odpowiedź jest z nim zgodna; potrzebne jest sprawdzenie treści.",
    role: /dokument|sprawdz|weryfik/i,
    evidenceLabels: ["Sprawdzenie źródła informacji modelu"],
  },
  {
    matches: (t) => has(t, /odpowied|wynik/i, /porówn/i, /oczekiwan|wzorc|referenc/i),
    summary:
      "Według odpowiedzi wyniki AI porównywano z przygotowanym punktem odniesienia, czyli z tym, czego oczekiwano.",
    skill: "opisać porównanie odpowiedzi AI z oczekiwanym wynikiem",
    boundary: "punkt odniesienia był poprawny",
    relevance:
      "Takie porównanie pomaga oceniać poprawność odpowiedzi zamiast polegać tylko na tym, czy brzmi przekonująco.",
    limit:
      "Opis metody nie potwierdza poprawności samego punktu odniesienia ani skuteczności AI w nowych przypadkach.",
    role: /porówna|sprawdz|wynik|ewaluac/i,
  },
  {
    matches: (t) =>
      has(t, /źle|błęd|niepopraw/i, /interpret|iterpret/i, /sprzeczn|przeczyły|przecząc/i),
    summary: "Osoba opisuje błędną interpretację sprzecznych danych przez system.",
    skill: "wskazać błąd AI przy sprzecznych danych",
    boundary: "potrafi skutecznie usunąć ten błąd",
    relevance:
      "Sprzeczne informacje mogą prowadzić do mylącego wniosku, nawet gdy odpowiedź AI brzmi pewnie.",
    limit:
      "Sam opis błędu nie potwierdza, że został usunięty, ani nie mówi, jak często się pojawiał.",
    role: /błęd|sprawdz|danych|model/i,
    evidenceLabels: ["Konkretny błąd modelu AI"],
  },
  {
    matches: (t) => has(t, /model|asystent/i, /zmyślał|pomijał|gubił/i),
    summary:
      "Osoba opisuje przypadek, w którym AI podawało zmyślone informacje lub pomijało potrzebne dane.",
    skill: "wskazać zmyślanie lub pomijanie informacji jako błąd AI",
    boundary: "zna częstość tego błędu",
    relevance:
      "Pokazuje to rodzaj problemu, który trzeba uwzględnić przy sprawdzaniu odpowiedzi systemu.",
    limit:
      "Pojedynczy przykład nie określa częstości błędu ani skuteczności późniejszych poprawek.",
    role: /błęd|sprawdz|model/i,
    evidenceLabels: ["Konkretny błąd modelu AI"],
  },
  {
    matches: (t) =>
      has(
        t,
        /po (?:wykry|błęd)|napraw|poprawk/i,
        /zmieni|dodali|poprawi/i,
        /prompt|instrukcj|model/i,
      ),
    summary:
      "Według odpowiedzi po wykryciu problemu zmieniono sposób instruowania lub działania modelu.",
    skill: "opisać zmianę w AI po wykryciu błędu",
    boundary: "zmiana skutecznie usunęła problem",
    relevance: "Opisuje to reakcję na błąd, a nie tylko jego zauważenie.",
    limit:
      "Wprowadzenie zmiany nie potwierdza, że problem zniknął; potrzebne jest ponowne sprawdzenie na przykładach.",
    role: /błęd|sprawdz|model|iterac/i,
    evidenceLabels: ["Zmiana po wykryciu błędu AI"],
  },
];

export function briefExplanation(explanations: ReturnType<typeof explainReply>) {
  const selected = explanations.slice(0, 2);
  if (!selected.length)
    return "Ta odpowiedź nie daje wystarczających podstaw do wniosku o umiejętnościach. Nie oznacza to ich braku.";
  return `Odpowiedź pokazuje, że osoba potrafi ${selected.map((item) => item.skill).join(" oraz ")}. Nie oznacza to, że ${selected.map((item) => item.boundary).join(" ani że ")}.`;
}

export function explainReply(reply: string | null, sources: Sources) {
  const parts = (reply ?? "").split(/(?<=[.!?])\s+|\n+/);
  const sentences = parts.filter(
    (text) =>
      !/nie (?:wiem|pamiętam|sprawdz|testowa|wysła|wysyła|przekaz|przygotowa|zmieni|doda|porówn|zmyśla|pomija|gubi)|gdybym|hipotetycz|mógłby|mogłabym/i.test(
        text,
      ),
  );
  // A description may span sentences. Keep the whole original quote only when
  // none of its sentences is uncertain, hypothetical or negated.
  if (reply && parts.length > 1 && sentences.length === parts.length) sentences.push(reply);
  const offer = sources.description
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((text) => !text.startsWith("#"));
  return rules.flatMap(({ matches, role, ...explanation }) => {
    const quote = sentences.find(matches);
    return quote
      ? [{ ...explanation, quote, roleQuote: offer.find((text) => role.test(text)) ?? "" }]
      : [];
  });
}
