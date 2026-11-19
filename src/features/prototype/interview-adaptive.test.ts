import { describe, expect, it } from "vitest";
import { initialState, transition } from "./model";
import { parseState, serializeState } from "./storage";
import {
  completedInterviewSchema,
  interviewSchema,
  interviewSources,
  nextQuestion,
  prompt,
  reportCoverage,
  type Interview,
} from "./interview";

const state = initialState();
const sources = interviewSources(state.people[0].cv, state.jobs[0]);
function start(): Interview {
  return { version: 1, adaptiveFrom: 0, detailFrom: 0, sources, turns: [] };
}
function answer(interview: Interview, reply: string | null) {
  const question = nextQuestion(interview)!;
  return interviewSchema.parse({
    ...interview,
    turns: [
      ...interview.turns,
      { id: question.id, question: prompt(interview.sources, question), reply },
    ],
  });
}
const research = "Przeprowadziłam wywiady z 18 użytkownikami, obserwując obsługę ich zgłoszeń.";
const allTopics =
  research +
  " Asystent porządkował zgłoszenia; wybraliśmy model AI, ponieważ pozwalał obsługiwać swobodny tekst." +
  " Porównaliśmy czas obsługi 100 zgłoszeń przez dwa tygodnie przed i po wdrożeniu." +
  " Model pomijał daty w odpowiedziach. Dodaliśmy ręczną kontrolę błędnych wyników.";

describe("adaptive interview", () => {
  it("asks for missing practical details in every area instead of CV headlines", () => {
    let interview = start();
    const asked: string[] = [];
    while (nextQuestion(interview)) {
      asked.push(prompt(interview.sources, nextQuestion(interview)!));
      interview = answer(interview, null);
    }
    expect(asked).toEqual([
      "W CV wspominasz o badaniach z 18 użytkownikami. Jak przeprowadziłaś te badania, żeby ustalić, w czym asystent miał im pomagać?",
      "W CV wymieniasz priorytetyzację. Jaką decyzję o zakresie pierwszej wersji asystenta podjęłaś osobiście?",
      "Na przykładzie jednego przypadku opisz rolę AI lub sposób wykonania zadania bez niego.",
      "Jak wykonano pomiar, z którego pochodzi podany w CV wynik 30%?",
      "Opisz konkretną sytuację, w której rozwiązanie nie zadziałało zgodnie z oczekiwaniami.",
    ]);
  });
  it("does not treat repeating a CV or a headline about responsibility as new detail", () => {
    const copied = answer(start(), sources.cv);
    expect(reportCoverage(copied).every((area) => !area.covered)).toBe(true);
    const vague = answer(
      start(),
      "Przeprowadziłam badania z 18 użytkownikami i odpowiadałam za wdrożenie asystenta.",
    );
    expect(nextQuestion(vague)?.id).toBe("own");
    expect(reportCoverage(vague).find((area) => area.id === "own")?.covered).toBe(false);
    const specific = answer(
      start(),
      "Wybrałam tylko klasyfikację zgłoszeń do pierwszej wersji asystenta.",
    );
    expect(nextQuestion(specific)?.id).toBe("ai");
  });
  it("selects deeper questions when a rich CV already gives methods, rationale and fixes", () => {
    let interview = { ...start(), sources: { ...sources, cv: allTopics } };
    const asked: string[] = [];
    while (nextQuestion(interview)) {
      asked.push(prompt(interview.sources, nextQuestion(interview)!));
      interview = answer(interview, null);
    }
    expect(asked[0]).toContain("Jak dobrano osoby lub przypadki");
    expect(asked[2]).toContain("prostszą metodą");
    expect(asked[3]).toContain("miarodajne porównanie");
    expect(asked[4]).toContain("czy ta zmiana pomogła");
  });
  it("uses a CV task or failure as context without asking for it again", () => {
    const custom = {
      ...start(),
      sources: {
        ...sources,
        cv: sources.cv + "\nAsystent porządkował zgłoszenia. Model pomijał daty.",
      },
    };
    let interview = answer(custom, research);
    expect(prompt(interview.sources, nextQuestion(interview)!)).toBe(
      "Co przesądziło o wyborze tego sposobu wykorzystania AI?",
    );
    interview = answer(interview, "Wybraliśmy AI, ponieważ zgłoszenia miały swobodną treść.");
    interview = answer(interview, null);
    expect(prompt(interview.sources, nextQuestion(interview)!)).toBe(
      "Jak zareagowano na błąd lub ograniczenie opisane w CV?",
    );
  });
  it("keeps sparse CV questions free of invented studies, assistants and metrics", () => {
    let interview = { ...start(), sources: { ...sources, cv: "Praca w latach 2022–2024." } };
    const asked: string[] = [];
    while (nextQuestion(interview)) {
      asked.push(prompt(interview.sources, nextQuestion(interview)!));
      interview = answer(interview, null);
    }
    expect(asked[0]).toContain("Wybierz własny projekt");
    expect(asked.join(" ")).not.toMatch(/18|30%|asystenta|priorytetyzac/);
  });
  it("narrows every partially covered multi-facet topic in either order", () => {
    for (const [reply, expected] of [
      [
        "Wybraliśmy model AI, ponieważ obsługiwał swobodny tekst.",
        "Na przykładzie jednego przypadku",
      ],
      ["Asystent porządkował zgłoszenia.", "Co przesądziło"],
    ]) {
      const interview = answer(start(), research + " " + reply);
      expect(prompt(sources, nextQuestion(interview)!)).toContain(expected);
    }
    for (const [reply, expected] of [
      ["Model pomijał daty.", "Jak zareagowano"],
      ["Dodaliśmy ręczną kontrolę błędnych wyników.", "Opisz konkretną sytuację"],
    ]) {
      let interview = answer(start(), research + " " + reply);
      interview = answer(interview, null);
      interview = answer(interview, null);
      expect(prompt(sources, nextQuestion(interview)!)).toContain(expected);
    }
  });
  it("uses a single answer for several topics and links exact evidence to its original turn", () => {
    const interview = answer(start(), research);
    expect(nextQuestion(interview)?.id).toBe("ai");
    expect(
      reportCoverage(interview)
        .filter((area) => area.covered)
        .map((area) => area.id),
    ).toEqual(["goal", "own"]);
    for (const area of reportCoverage(interview).filter((area) => area.covered)) {
      expect(area.facts[0]).toMatchObject({ turn: 1, text: research });
    }
  });
  it("does not assume AI was used when the candidate says it was not", () => {
    const interview = answer(start(), research + " Nie używaliśmy AI.");
    expect(prompt(sources, nextQuestion(interview)!)).toBe(
      "Dlaczego zdecydowano się wykonać to zadanie bez AI?",
    );
  });
  it("asks for a missing measurement period, but not one already given in context", () => {
    const reply = allTopics.replace("przez dwa tygodnie ", "");
    const interview = answer(start(), reply + " Okres porównania był krótki.");
    expect(nextQuestion(interview)?.id).toBe("period");
    const cvPeriod = {
      ...start(),
      sources: { ...sources, cv: sources.cv + " Porównaliśmy czas obsługi przez dwa tygodnie." },
    };
    expect(nextQuestion(answer(cvPeriod, reply))?.id).not.toBe("period");
  });
  it("preserves answered sequences from the earlier adaptive policy when resuming", () => {
    let old: Interview = { version: 1, adaptiveFrom: 0, sources, turns: [] };
    old = answer(old, "Przygotowałam formularz.");
    expect(nextQuestion(old)?.id).toBe("ai");
    old = answer(old, null);
    const migrated = { ...old, detailFrom: old.turns.length };
    expect(interviewSchema.safeParse(migrated).success).toBe(true);
    expect(nextQuestion(migrated)?.id).toBe("own");
    expect(answer(migrated, "Wybrałam tylko klasyfikację zgłoszeń.").turns.slice(0, 2)).toEqual(
      old.turns,
    );
  });
  it("asks only the missing part of an AI description with the earlier answer as context", () => {
    const interview = answer(start(), research + " Asystent porządkował zgłoszenia.");
    const question = nextQuestion(interview)!;
    expect(question.id).toBe("ai");
    expect(prompt(sources, question)).toBe(
      "Co przesądziło o wyborze tego sposobu wykorzystania AI?",
    );
    expect(question.context?.text).toBe("Asystent porządkował zgłoszenia.");
    const continued = answer(interview, "Wybraliśmy model AI, ponieważ obsługiwał swobodny tekst.");
    expect(reportCoverage(continued).find((area) => area.id === "ai")?.covered).toBe(true);
    expect(nextQuestion(continued)?.id).toBe("effect");
  });
  it("finishes without filling a quota when all areas and relevant clarifications are described", () => {
    const interview = answer(start(), allTopics);
    expect(nextQuestion(interview)).toBeUndefined();
    expect(completedInterviewSchema.safeParse(interview).success).toBe(true);
    expect(reportCoverage(interview).every((area) => area.covered)).toBe(true);
  });
  it("does not mark CV, keyword lists, vague claims or negated work as coverage", () => {
    expect(reportCoverage(start()).every((area) => !area.covered)).toBe(true);
    for (const reply of [
      "Badania, model, błędy, testy, mój wkład.",
      "Zrobiłam wszystko i wszystko działało dobrze.",
      "Nie przeprowadziłam wywiadów z użytkownikami.",
      "Nie pamiętam, czy analizowałam zgłoszenia.",
      "Nie porównaliśmy czasu obsługi 100 zgłoszeń.",
    ]) {
      expect(reportCoverage(answer(start(), reply)).every((area) => !area.covered)).toBe(true);
    }
  });
  it("continues after skipped or unknown replies and lists remaining gaps without a score", () => {
    let interview = start();
    for (let count = 0; count < 5; count++)
      interview = answer(interview, count % 2 ? "Nie wiem." : null);
    expect(nextQuestion(interview)).toBeUndefined();
    expect(reportCoverage(interview).every((area) => area.missingLabels.length)).toBe(true);
    expect(reportCoverage(interview).filter((area) => area.skipped)).toHaveLength(3);
  });
  it("limits clarifications to three, with outstanding partial answers recorded as gaps", () => {
    let interview = start();
    for (const reply of [
      "Opis projektu.",
      "Wspólnie podjęliśmy decyzję.",
      "Asystent porządkował zgłoszenia.",
      "Porównaliśmy wyniki.",
      "Model pomijał daty.",
    ])
      interview = answer(interview, reply);
    expect(nextQuestion(interview)?.id).toBe("detail_ai");
    for (let count = 0; count < 3; count++) interview = answer(interview, "Nie pamiętam.");
    expect(interview.turns).toHaveLength(8);
    expect(nextQuestion(interview)).toBeUndefined();
    expect(reportCoverage(interview).filter((area) => !area.covered)).toHaveLength(5);
  });
  it("resumes older drafts adaptively while retaining saved replies and submitted legacy reports", () => {
    let scenario = transition(state, { type: "select_person", id: "candidate-anna" });
    const draft: Interview = {
      version: 1,
      sources,
      turns: [{ id: "goal", reply: research, question: "Dawne pytanie." }],
    };
    scenario.drafts.push({
      candidateId: "candidate-anna",
      jobId: state.jobs[0].id,
      answer: "",
      notes: "",
      generated: "",
      interview: draft,
    });
    scenario = transition(scenario, {
      type: "interview_start",
      jobId: state.jobs[0].id,
      answer: "",
    });
    const restored = parseState(serializeState(scenario)).drafts[0].interview!;
    expect(restored.adaptiveFrom).toBe(1);
    expect(restored.detailFrom).toBe(1);
    expect(restored.aiFrom).toBe(1);
    expect(restored.turns).toEqual(draft.turns);
    expect(nextQuestion(restored)?.id).toBe("own");
    expect(interviewSchema.safeParse({ ...restored, adaptiveFrom: 2 }).success).toBe(false);
    const legacy = {
      ...draft,
      turns: [
        ...draft.turns,
        ...["own", "ai", "effect", "limits"].map((id) => ({ id, reply: null })),
      ],
    };
    expect(completedInterviewSchema.safeParse(legacy).success).toBe(true);
  });
});
