import { describe, expect, it } from "vitest";
import { initialState } from "./model";
import { briefExplanation, explainReply } from "./interview-explanations";
import { interviewSources, reportCoverage, reportItems, type Interview } from "./interview";

const state = initialState();
const sources = interviewSources(state.people[0].cv, state.jobs[0]);
const replies = [
  "Sprawdziłam powtarzalne zadania i te które zajmują im najwięcej czasu by ustalić co wymaga optymalizacji.",
  "zaznaczył kilka kwestii/sytuacji i wysłał do oceny człowieka",
  "Jeśli zgloszenie tyczyło czegoś powtarzalnego to model miał gotowe instrukcjie ale aby je zastoasowacm usiał przeanalizować treść. Co do bardziej skomplikowancyh to analziwoał całość i szzacował problem.",
  "Dublowaliśmy zgłoszenia, opisywaliśmy przeczące sobie rzeczy",
  "Stwierdził że błąd może byc sukcesem bo źle ziterpretował dane, lecz dane przeczyły sobie",
];

describe("plain-language report explanations", () => {
  it("keeps the visible interpretation short, grounded and limited even for multi-topic replies", () => {
    const testMeaning = briefExplanation(explainReply(replies[3], sources));
    expect(testMeaning).toContain("potrafi wskazać powtórzenia i sprzeczne dane");
    expect(testMeaning).toContain("Nie oznacza to, że potrafi ocenić wyniki tych testów");
    const multiple = explainReply(replies.join(". "), sources);
    expect(multiple.length).toBeGreaterThan(2);
    expect(briefExplanation(multiple).length).toBeLessThan(550);
    expect(briefExplanation(multiple)).not.toMatch(/potrafi wdrożyć|potrafi zaprojektować/);
    expect(briefExplanation(explainReply("Nie wiem.", sources))).toContain(
      "Nie oznacza to ich braku",
    );
  });
  it("explains actual replies, including the synthetic recruiter's examples, with limits", () => {
    const summaries = replies.map((reply) =>
      explainReply(reply, sources)
        .map((item) => item.summary)
        .join(" "),
    );
    expect(summaries[0]).toContain("czasochłonnych");
    expect(summaries[1]).toContain("człowieka");
    expect(summaries[2]).toContain("dwa sposoby obsługi");
    expect(summaries[3]).toContain("powtórzonych zgłoszeniach i sprzecznych");
    expect(summaries[4]).toContain("błędną interpretację sprzecznych");
    for (const reply of replies)
      for (const item of explainReply(reply, sources)) {
        expect(reply).toContain(item.quote);
        expect(sources.description).toContain(item.roleQuote);
        expect(item.limit.length).toBeGreaterThan(30);
      }
  });
  it("does not infer competence, personal authorship or a successful test from a handoff", () => {
    const [item] = explainReply(replies[1], sources);
    expect(item.summary).not.toMatch(/samodziel|zaprojektował|skuteczn/);
    expect(item.limit).toContain("nie potwierdza");
    const [tests] = explainReply(replies[3], sources);
    expect(tests.limit).toContain("nie mówi, czy system przeszedł testy");
  });
  it("keeps negative, unknown and hypothetical replies out of positive explanations", () => {
    for (const text of [
      null,
      "Lubię pracować w zespole.",
      "Nie wysłał sprawy do człowieka.",
      "Model nie zmyślał danych.",
      "Gdybym dodała do promptu prośbę o brakujące dane.",
      "Nie pamiętam, czy porównaliśmy odpowiedzi z oczekiwanymi wynikami.",
    ]) {
      expect(explainReply(text, sources)).toEqual([]);
    }
    expect(
      explainReply("System dublował zgłoszenia zawierające sprzeczne opisy.", sources),
    ).toEqual([]);
  });
  it("explains several statements in one reply and uses only saved sources", () => {
    const text = replies[1] + ". " + replies[3];
    expect(explainReply(text, sources)).toHaveLength(2);
    const custom = {
      ...sources,
      description: "Projektowanie ilustracji.",
      summary: "Inna oferta.",
    };
    expect(explainReply(text, custom).every((item) => !item.roleQuote)).toBe(true);
  });
  it("updates presentation of old transcripts without modifying their content or falsely listing recognized details as absent", () => {
    const transcript: Interview = {
      version: 1,
      adaptiveFrom: 0,
      detailFrom: 0,
      aiFrom: 1,
      sources,
      turns: ["goal", "own", "ai", "effect", "limits"].map((id, index) => ({
        id,
        reply: replies[index],
        question: "Zapisane pytanie " + index,
      })),
    };
    const before = JSON.stringify(transcript);
    expect(reportItems(transcript)[3].explanations[0].summary).toContain("testowanie AI");
    const coverage = reportCoverage(transcript);
    expect(coverage.find((area) => area.id === "effect")?.missingLabels).not.toContain(
      "Przygotowanie przykładów do testowania AI",
    );
    expect(coverage.find((area) => area.id === "limits")?.missingLabels).toContain(
      "Zmiana po wykryciu błędu AI",
    );
    expect(JSON.stringify(transcript)).toBe(before);
  });
});
