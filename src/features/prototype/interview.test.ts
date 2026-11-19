import { describe, expect, it } from "vitest";
import { initialState, transition } from "./model";
import { parseState, serializeState } from "./storage";
import {
  completedInterviewSchema,
  interviewSchema,
  interviewSources,
  nextQuestion,
  prompt,
  reportItems,
  type Interview,
} from "./interview";

const base = initialState();
const [anna, marek] = base.people;
const [manager, engineer] = base.jobs;
const sources = interviewSources(anna.cv, manager);
function dialogue(answers: Array<string | null>): Interview {
  const interview: Interview = { version: 1, sources, turns: [] };
  for (const reply of answers) {
    const next = nextQuestion(interview)!;
    interview.turns.push({ id: next.id, reply });
  }
  return interview;
}
const triggers = [
  "Porównaliśmy wyniki.",
  "Wspólnie podjęliśmy decyzję.",
  "Przekazujemy sprawy operatorowi.",
  null,
  null,
];
describe("local verification", () => {
  it("asks for research methods and preserves the actual question across reload and legacy reports", () => {
    const goal = nextQuestion({ version: 1, sources, turns: [] })!;
    expect(prompt(sources, goal)).toBe(
      "W CV wspominasz o badaniach z 18 użytkownikami. Jak przeprowadziłaś te badania, żeby ustalić, w czym asystent miał im pomagać?",
    );
    const withFinding = {
      ...sources,
      cv: sources.cv + "\nBadania wykazały problemy z kompletnością zgłoszeń.",
    };
    expect(prompt(withFinding, goal)).toBe(prompt(sources, goal));
    const unrelated = {
      ...sources,
      cv: "Badania z 18 użytkownikami i wdrożenie asystenta zakupowego.",
    };
    expect(prompt(unrelated, goal)).not.toContain("zgłoszeń");
    expect(prompt({ ...sources, cv: marek.cv }, goal)).not.toContain("18 użytkownikami");
    const legacy = dialogue([null, null, null, null, null]);
    expect(reportItems(legacy)[0].question).toBe(
      "Który problem w Twoim projekcie uzasadniał rozpoczęcie prac?",
    );
    let state = transition(base, { type: "select_person", id: anna.id });
    state = transition(state, { type: "interview_start", jobId: manager.id, answer: "" });
    const currentQuestion = prompt(sources, nextQuestion(state.drafts[0].interview!)!);
    state = transition(state, {
      type: "interview_reply",
      jobId: manager.id,
      answer: "",
      position: 0,
      questionId: "goal",
      reply: "Użytkownicy wskazali powtarzalną pracę.",
    });
    const saved = parseState(serializeState(state)).drafts[0].interview!;
    expect(reportItems(saved)[0].question).toBe(currentQuestion);
  });
  it("selects grounded role and CV context for changed inputs", () => {
    const i = dialogue([null, null, null, null, null]);
    const metric = i.turns[3];
    const other = { ...i, sources: interviewSources(marek.cv, manager) };
    expect(reportItems(i)[3].question).toContain("30%");
    expect(reportItems(other)[3].question).toContain("25%");
    expect(
      reportItems({ ...i, sources: interviewSources(anna.cv, engineer) })[0].question,
    ).not.toBe(reportItems(i)[0].question);
    expect(metric.id).toBe("effect");
    for (const row of reportItems(i)) {
      expect(sources.cv).toContain(row.cv);
      expect(sources.description + sources.summary).toContain(row.role);
    }
    const sparse = { ...sources, cv: "Praca w latach 2022–2024." };
    expect(prompt(sparse, nextQuestion({ ...i, sources: sparse, turns: [] })!)).toContain(
      "Wybierz własny projekt",
    );
  });
  it("asks at most three independent clarifications and uses the entire transcript", () => {
    const full = dialogue([...triggers, null, null, null]);
    expect(full.turns.slice(5).map((t) => t.id)).toEqual(["period", "decision", "handoff"]);
    expect(completedInterviewSchema.safeParse(full).success).toBe(true);
    expect(nextQuestion(full)).toBeUndefined();
    expect(
      interviewSchema.safeParse({ ...full, turns: [...full.turns, full.turns[7]] }).success,
    ).toBe(false);
    expect(interviewSchema.safeParse({ ...full, turns: full.turns.slice(1) }).success).toBe(false);
    const explained = dialogue([
      ...triggers.slice(0, 4),
      "Samodzielnie wybrałam metodę. Okres pomiaru to dwa dni. Zgłoszenia przekazujemy, gdy model zgłasza błąd.",
    ]);
    expect(nextQuestion(explained)).toBeUndefined();
    expect(nextQuestion(dialogue(Array(5).fill(null)))).toBeUndefined();
    expect(
      nextQuestion(
        dialogue(["Nie porównaliśmy wyników.", "Porównaliśmy dostawców.", null, null, null]),
      ),
    ).toBeUndefined();
  });
  it("keeps the transcript in its draft, validates explicit attachment and isolates employer review", () => {
    const answer = "Chcę opisać doświadczenie w pracy nad projektem.";
    const jobId = manager.id;
    let state = transition(base, { type: "select_person", id: anna.id });
    state = transition(state, { type: "interview_start", jobId, answer });
    const submit = {
      type: "submit",
      jobId,
      answer,
      notes: "",
      generated: "",
      consent: true,
      includeReport: true,
    } as const;
    expect(() => transition(state, submit)).toThrow();
    for (const t of dialogue(Array(5).fill(null)).turns) {
      const action = {
        type: "interview_reply",
        jobId,
        answer,
        position: state.drafts[0].interview!.turns.length,
        questionId: t.id,
        reply: t.id === "own" ? "Napisałam formularz." : null,
      } as const;
      state = parseState(serializeState(transition(state, action)));
      expect(() => transition(state, action)).toThrow();
    }
    expect(state.applications.at(-1)?.report).toBeUndefined();
    const changed = structuredClone(state);
    changed.jobs[0].description += " Nowy obowiązek.";
    expect(() => transition(changed, submit)).toThrow();
    expect(
      transition(changed, { ...submit, includeReport: false }).applications.at(-1)?.report,
    ).toBeUndefined();
    const restarted = transition(changed, { type: "interview_start", jobId, answer });
    expect(restarted.drafts[0].interview?.turns).toHaveLength(0);
    state = transition(state, submit);
    const application = state.applications.at(-1)!;
    state.people[0].cv = "Zmieniona treść po wysłaniu.";
    state.jobs[0].description = changed.jobs[0].description;
    expect(application.report?.sources).toEqual(sources);
    expect(reportItems(application.report!)[1].reply).toBe("Napisałam formularz.");
    const review = {
      type: "report_review",
      applicationId: application.id,
      review: { reviewer: "Ekspert", minutes: 4, corrections: "Sprawdzono cytaty." },
    } as const;
    expect(() => transition(state, review)).toThrow();
    expect(() =>
      transition(transition(state, { type: "select_person", id: "employer-northstar" }), review),
    ).toThrow();
    state = transition(
      transition(state, { type: "select_person", id: "employer-brightlabs" }),
      review,
    );
    expect(parseState(serializeState(state)).applications.at(-1)?.review).toEqual(review.review);
  });
});
