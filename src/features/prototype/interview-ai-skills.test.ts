import { describe, expect, it } from "vitest";
import { initialState, transition } from "./model";
import {
  interviewSchema,
  interviewSources,
  nextQuestion,
  prompt,
  reportCoverage,
  type Interview,
} from "./interview";

const state = initialState();
const sources = interviewSources(state.people[0].cv, state.jobs[0]);
const start = (): Interview => ({
  version: 1,
  adaptiveFrom: 0,
  detailFrom: 0,
  aiFrom: 0,
  sources,
  turns: [],
});
const reply = (i: Interview, text: string | null): Interview => {
  const q = nextQuestion(i)!;
  return interviewSchema.parse({
    ...i,
    turns: [...i.turns, { id: q.id, question: prompt(i.sources, q), reply: text }],
  });
};
const feasibility =
  "Przed wdrożeniem testowaliśmy model na 40 zgłoszeniach i porównaliśmy wyniki z oczekiwanymi odpowiedziami.";
const instruction =
  "Dodałam do instrukcji modelu polecenie: przy braku danych poproś o uzupełnienie.";
const context =
  "Do kontekstu modelu wybieraliśmy fragmenty dokumentów dopasowane do kategorii zgłoszenia.";
const provenance =
  "Sprawdzaliśmy odpowiedzi modelu, porównując cytat i identyfikator dokumentu źródłowego.";
const examples =
  "Przygotowaliśmy zestaw testowy obejmujący zgłoszenia z brakującymi danymi i nietypowe przypadki.";
const evaluation =
  "Ocenialiśmy poprawność odpowiedzi przez porównanie z oczekiwanym wzorcem i zapisywaliśmy rozbieżności.";
const failure = "Model zmyślał daty.";
const correction =
  "Po wykryciu błędu zmieniliśmy prompt, dodając zakaz dopisywania dat bez źródła.";

describe("practical AI interview", () => {
  it("asks five AI-specific questions and rejects CV headlines as evidence", () => {
    let i = start();
    const headline =
      "Razem z zespołem wdrożyłam asystenta do kategoryzacji zgłoszeń i przygotowywania odpowiedzi zatwierdzanych przez człowieka. Czas obsługi skrócił się o 30%.";
    i.sources = { ...sources, cv: sources.cv + " " + headline };
    const questions: string[] = [];
    for (let n = 0; n < 5; n++) {
      questions.push(prompt(i.sources, nextQuestion(i)!));
      i = reply(i, headline);
    }
    expect(questions[0]).toContain("czy model AI nadaje się");
    expect(questions[1]).toContain("Jaką instrukcję otrzymywał model AI");
    expect(questions[2]).toContain("Jak wybieraliście informacje");
    expect(questions[3]).toContain("przykłady testowe");
    expect(questions[4]).toContain("konkretny błąd modelu");
    expect(reportCoverage(i).every((area) => !area.covered)).toBe(true);
    expect(nextQuestion(i)).toBeUndefined();
  });
  it("uses one response across areas, narrows the next prompt, and retains exact citations", () => {
    const i = reply(start(), [feasibility, instruction, context].join(" "));
    const q = nextQuestion(i)!;
    expect(q.id).toBe("ai");
    expect(prompt(i.sources, q)).toContain("materiału źródłowego");
    expect(q.context).toMatchObject({ text: context, turn: 1 });
    expect(reportCoverage(i).find((area) => area.id === "own")?.covered).toBe(true);
    const continued = reply(i, [provenance, examples, evaluation].join(" "));
    expect(nextQuestion(continued)?.id).toBe("limits");
    expect(nextQuestion(reply(continued, failure + " " + correction))).toBeUndefined();
  });
  it("finishes after one detailed response without filling a quota", () => {
    const i = reply(
      start(),
      [
        feasibility,
        instruction,
        context,
        provenance,
        examples,
        evaluation,
        failure,
        correction,
      ].join(" "),
    );
    expect(reportCoverage(i).every((area) => area.covered)).toBe(true);
    expect(nextQuestion(i)).toBeUndefined();
  });
  it("does not ask for a detail already present anywhere in the CV", () => {
    let i = start();
    i.sources = { ...sources, cv: sources.cv + "\n" + instruction + "\n" + context };
    i = reply(i, feasibility);
    expect(nextQuestion(i)?.id).toBe("ai");
    expect(prompt(i.sources, nextQuestion(i)!)).toContain("materiału źródłowego");
    expect(reportCoverage(i).find((area) => area.id === "own")?.covered).toBe(false);
  });
  it("keeps three relevant follow-ups within eight turns and never repeats a prompt", () => {
    let i = start();
    for (const text of [
      "Nie pamiętam.",
      instruction.replace("Dodałam do", "Dodano do"),
      context,
      examples,
      failure,
    ])
      i = reply(i, text);
    expect(nextQuestion(i)?.id).toBe("detail_own");
    for (let n = 0; n < 3; n++) i = reply(i, null);
    expect(i.turns).toHaveLength(8);
    expect(new Set(i.turns.map((t) => t.question)).size).toBe(8);
    expect(nextQuestion(i)).toBeUndefined();
  });
  it("narrows failure handling in either order without repeating an unanswered question", () => {
    for (const [partial, expected] of [
      [failure, "Jaką zmianę"],
      [correction, "Opisz konkretny błąd"],
    ]) {
      const i = reply(
        start(),
        [feasibility, instruction, context, provenance, examples, evaluation, partial].join(" "),
      );
      expect(prompt(i.sources, nextQuestion(i)!)).toContain(expected);
    }
    let i = start();
    i = reply(i, feasibility);
    i = reply(i, "Dodałam do promptu przykład formatu JSON.");
    for (let n = 0; n < 3; n++) i = reply(i, null);
    expect(nextQuestion(i)).toBeUndefined();
  });
  it("migrates an unfinished detailed-policy draft without rewriting saved turns", () => {
    let scenario = transition(state, { type: "select_person", id: "candidate-anna" });
    const old: Interview = {
      version: 1,
      adaptiveFrom: 0,
      detailFrom: 0,
      sources,
      turns: [{ id: "goal", question: "Poprzednie pytanie.", reply: "Opis badań." }],
    };
    scenario.drafts.push({
      candidateId: "candidate-anna",
      jobId: state.jobs[0].id,
      answer: "",
      notes: "",
      generated: "",
      interview: old,
    });
    scenario = transition(scenario, {
      type: "interview_start",
      jobId: state.jobs[0].id,
      answer: "",
    });
    const resumed = scenario.drafts[0].interview!;
    expect(resumed.aiFrom).toBe(1);
    expect(resumed.turns).toEqual(old.turns);
    expect(prompt(sources, nextQuestion(resumed)!)).toContain("Jaką instrukcję");
    expect(interviewSchema.safeParse(reply(resumed, instruction)).success).toBe(true);
  });
});
