import { describe, expect, it } from "vitest";
import { initialState, transition } from "./model";
import { nextQuestion } from "./interview";
import { proposeTest, testResult } from "./optional-test";
import { parseState, serializeState } from "./storage";

function submitted() {
  let state = transition(initialState(), { type: "select_person", id: "candidate-anna" });
  const jobId = state.jobs[0].id;
  const answer = "Opis mojego syntetycznego projektu AI.";
  state = transition(state, { type: "interview_start", jobId, answer });
  const replies = [
    "Sprawdziłam powtarzalne zadania.",
    "Wysłał sprawę do oceny człowieka.",
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
  return transition(state, { type: "select_person", id: "employer-brightlabs" });
}
function invitation(state = submitted()) {
  const app = state.applications.at(-1)!;
  return {
    type: "test_invite" as const,
    applicationId: app.id,
    value: {
      questions: proposeTest(app.report!),
    },
  };
}

describe("optional closed AI test", () => {
  it("proposes only grounded gaps and never fills a five-question quota", () => {
    const report = submitted().applications.at(-1)!.report!;
    const questions = proposeTest(report);
    expect(questions.map((q) => q.id)).toEqual(["missing-data", "evaluation", "conflict"]);
    for (const q of questions)
      expect(report.turns.some((turn) => turn.reply?.includes(q.sourceQuote))).toBe(true);
    expect(
      proposeTest({ ...report, turns: report.turns.map((turn) => ({ ...turn, reply: null })) }),
    ).toEqual([]);
    expect(
      proposeTest({
        ...report,
        sources: {
          ...report.sources,
          description: "Projektowanie ilustracji",
          summary: "Ilustracje",
        },
      }),
    ).toEqual([]);
  });
  it("allows a direct recruiter invitation but still validates questions and ownership", () => {
    const state = submitted();
    const action = invitation(state);
    expect(state.applications.at(-1)!.optionalTest).toBeUndefined();
    expect(() => transition(state, { ...action, value: { questions: [] } })).toThrow();
    const invited = transition(state, action);
    expect(invited.applications.at(-1)!.optionalTest?.status).toBe("invited");
    expect(invited.applications.at(-1)!.optionalTest?.review).toBeUndefined();
    expect(parseState(serializeState(invited))).toEqual(invited);
    invited.applications.at(-1)!.optionalTest!.review = {
      reviewer: "Wcześniejsza kontrola",
      minutes: 4,
    };
    expect(parseState(serializeState(invited)).applications.at(-1)!.optionalTest?.review).toEqual({
      reviewer: "Wcześniejsza kontrola",
      minutes: 4,
    });
    for (const id of ["candidate-anna", "employer-northstar"])
      expect(() => transition(transition(state, { type: "select_person", id }), action)).toThrow();
    const skipped = transition(state, { type: "test_skip", applicationId: action.applicationId });
    expect(skipped.applications.at(-1)!.optionalTest?.status).toBe("skipped");
  });
  it("keeps the report immutable and allows a recruiter-edited test after stage completion", () => {
    let state = submitted();
    const action = invitation(state);
    const report = structuredClone(state.applications.at(-1)!.report);
    state = transition(state, {
      type: "stage",
      applicationId: action.applicationId,
      stage: "rejected",
      note: "",
    });
    action.value.questions[0].question += " Wybierz jedną odpowiedź.";
    state = parseState(serializeState(transition(state, action)));
    expect(state.applications.at(-1)!.stage).toBe("rejected");
    expect(state.applications.at(-1)!.report).toEqual(report);
    expect(state.applications.at(-1)!.optionalTest?.questions[0].question).toContain(
      "Wybierz jedną",
    );
    const forged = structuredClone(state);
    forged.applications.at(-1)!.optionalTest!.questions[0].sourceQuote = "Nieistniejący cytat.";
    expect(() => parseState(serializeState(forged))).toThrow();
    expect(() => transition(state, action)).toThrow();
    const reopened = transition(state, {
      type: "stage",
      applicationId: action.applicationId,
      stage: "reviewed",
      note: "Reopened",
    });
    expect(reopened.applications.at(-1)!.optionalTest).toEqual(
      state.applications.at(-1)!.optionalTest,
    );
    expect(reopened.applications.at(-1)!.report).toEqual(report);
  });
  it("persists answers, excludes unanswered and invalid questions, and supports n=0", () => {
    let state = submitted();
    const action = invitation(state);
    state = transition(state, action);
    state = transition(state, { type: "select_person", id: "candidate-anna" });
    const first = action.value.questions[0];
    const answer = {
      type: "test_answers" as const,
      applicationId: action.applicationId,
      answers: [{ questionId: first.id, answer: first.correct }],
      submit: false,
    };
    state = parseState(serializeState(transition(state, answer)));
    expect(state.applications.at(-1)!.optionalTest?.answers).toEqual(answer.answers);
    expect(() =>
      transition(state, { ...answer, answers: [{ questionId: "foreign", answer: "A" }] }),
    ).toThrow();
    state = transition(state, { ...answer, submit: true });
    expect(testResult(state.applications.at(-1)!.optionalTest!)).toEqual({
      correct: 1,
      assessed: 1,
      total: 3,
      unanswered: 2,
      invalid: 0,
    });
    state = transition(state, { type: "select_person", id: "employer-brightlabs" });
    state = transition(state, {
      type: "test_invalidate",
      applicationId: action.applicationId,
      questionId: first.id,
      reason: "Niejasne brzmienie.",
    });
    expect(testResult(state.applications.at(-1)!.optionalTest!)).toEqual({
      correct: 0,
      assessed: 0,
      total: 3,
      unanswered: 2,
      invalid: 1,
    });
  });
  it("keeps refusal distinct from a zero score and rejects edits after submission", () => {
    let state = submitted();
    const action = invitation(state);
    state = transition(transition(state, action), { type: "select_person", id: "candidate-anna" });
    expect(() =>
      transition(transition(state, { type: "select_person", id: "candidate-marek" }), {
        type: "test_decline",
        applicationId: action.applicationId,
      }),
    ).toThrow();
    state = transition(state, { type: "test_decline", applicationId: action.applicationId });
    expect(state.applications.at(-1)!.optionalTest?.status).toBe("declined");
    expect(() =>
      transition(state, {
        type: "test_answers",
        applicationId: action.applicationId,
        answers: [],
        submit: true,
      }),
    ).toThrow();
  });
});
