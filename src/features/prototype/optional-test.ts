import { z } from "zod";
import { isSituationalQuestion } from "./interview-ai-skills";
import { reportCoverage, type Interview } from "./interview";

export const letters = ["A", "B", "C", "D"] as const;
const letter = z.enum(letters);
const text = z.string().trim().min(1).max(2000);
export const testQuestionSchema = z
  .object({
    id: z.string().min(1).max(60),
    question: text,
    options: z.tuple([text, text, text, text]),
    correct: letter,
    explanation: text,
    checks: text,
    reason: text,
    limit: text,
    sourceQuote: text,
    valid: z.boolean(),
    invalidReason: z.string().max(2000),
  })
  .refine(
    (q) =>
      new Set(q.options.map((option) => option.toLocaleLowerCase("pl"))).size === 4 &&
      (q.valid || q.invalidReason.trim().length > 0),
    "Invalid question",
  );
export type TestQuestion = z.infer<typeof testQuestionSchema>;
export const testAnswersSchema = z
  .array(z.object({ questionId: z.string(), answer: letter.nullable() }))
  .max(5);
export const testInvitationSchema = z.object({
  questions: z.array(testQuestionSchema).min(1).max(5),
});
export const optionalTestSchema = z
  .object({
    status: z.enum(["skipped", "invited", "submitted", "declined"]),
    questions: z.array(testQuestionSchema).max(5),
    answers: testAnswersSchema,
    at: z.iso.datetime(),
    completedAt: z.iso.datetime().optional(),
    review: z
      .object({
        reviewer: z.string().min(1).max(200),
        minutes: z.number().int().positive().max(1440),
      })
      .optional(),
  })
  .refine((t) => {
    const ids = new Set(t.questions.map((q) => q.id));
    return (
      ids.size === t.questions.length &&
      new Set(t.answers.map((a) => a.questionId)).size === t.answers.length &&
      t.answers.every((a) => ids.has(a.questionId)) &&
      (t.status === "skipped"
        ? !t.questions.length && !t.answers.length
        : t.questions.length > 0) &&
      (t.status !== "submitted" || (t.answers.length === t.questions.length && !!t.completedAt)) &&
      (t.status !== "declined" || (!t.answers.length && !!t.completedAt))
    );
  }, "Invalid optional test");
export type OptionalTest = z.infer<typeof optionalTestSchema>;

const catalog = [
  {
    id: "missing-data",
    area: "own",
    gapPattern: /instrukcja modelu|własny wkład/i,
    trigger: /człowiek|człowieka|brak.{0,30}(?:danych|informac)/i,
    question:
      "Model przygotowuje odpowiedź na zgłoszenie, ale brakuje numeru faktury. Która instrukcja ogranicza dopisywanie nieznanych informacji?",
    options: [
      "Wybierz najbardziej prawdopodobny numer faktury.",
      "Wskaż brak numeru i poproś o jego uzupełnienie.",
      "Użyj numeru z podobnego wcześniejszego zgłoszenia.",
      "Wygeneruj odpowiedź bez informowania o braku danych.",
    ],
    correct: "B",
    explanation:
      "Wskazanie brakującej informacji i prośba o jej uzupełnienie nie wymagają wymyślania numeru faktury.",
    checks: "Rozpoznanie instrukcji dla AI przy brakujących danych.",
    reason:
      "W rozmowie pojawia się brak danych lub ocena człowieka, ale instrukcja modelu nie została dostatecznie wyjaśniona.",
    limit:
      "Wybór odpowiedzi nie potwierdzi, że kandydat sam przygotował lub przetestował taką instrukcję.",
  },
  {
    id: "evaluation",
    area: "effect",
    gapPattern: /ocena poprawności|sprawdzania wyniku/i,
    trigger: /test|dublowa|przecząc|przykład|porówn/i,
    question:
      "Zmieniono instrukcję modelu po wykryciu błędów. Jak najlepiej sprawdzić, czy poprawa dotyczy także innych zgłoszeń?",
    options: [
      "Użyć niewykorzystanych przy poprawce przykładów z wcześniej ustalonymi oczekiwanymi odpowiedziami.",
      "Sprawdzić tylko przykład, na którym zmieniono instrukcję.",
      "Zapytać model, czy nowa instrukcja jest lepsza.",
      "Ocenić jedynie płynność języka nowych odpowiedzi.",
    ],
    correct: "A",
    explanation:
      "Oddzielne przykłady i ustalony punkt odniesienia pozwalają sprawdzić, czy poprawa wykracza poza przypadek użyty do zmiany instrukcji.",
    checks: "Dobór sposobu sprawdzania poprawności AI.",
    reason:
      "Kandydat opisał sprawdzanie lub przykłady, ale sposób oceny poprawności pozostaje niewyjaśniony.",
    limit:
      "Odpowiedź sprawdza rozpoznanie zasady, a nie umiejętność zbudowania pełnego zestawu testowego.",
  },
  {
    id: "sources",
    area: "ai",
    gapPattern: /źródła informacji|powód wyboru/i,
    trigger: /źród|dokument|baz.{0,10}wiedzy|cytat/i,
    question:
      "Odpowiedź AI zawiera link do dokumentu. Co pozwoli sprawdzić, czy podana informacja ma oparcie w tym źródle?",
    options: [
      "Sam fakt, że link otwiera istniejący dokument.",
      "Pewny ton odpowiedzi modelu.",
      "Porównanie konkretnego twierdzenia z treścią wskazanego fragmentu dokumentu.",
      "Długość i szczegółowość odpowiedzi.",
    ],
    correct: "C",
    explanation:
      "Istniejący link nie dowodzi zgodności twierdzenia ze źródłem. Trzeba porównać treść odpowiedzi z materiałem.",
    checks: "Rozpoznanie sposobu kontroli źródeł odpowiedzi AI.",
    reason:
      "W rozmowie wspomniano materiały źródłowe, ale ich kontrola nie została dostatecznie opisana.",
    limit: "Prawidłowy wybór nie potwierdzi wdrożenia mechanizmu kontroli źródeł.",
  },
  {
    id: "conflict",
    area: "limits",
    gapPattern: /zmiana po|postępowania z ograniczeniem/i,
    trigger: /sprzeczn|przeczy|zmyśla|źle.{0,20}(?:interpret|iterpret)/i,
    question:
      "Dwa dostępne dokumenty podają różne terminy płatności i nie wiadomo, który jest aktualny. Jak powinien zachować się asystent?",
    options: [
      "Wybrać termin z dłuższego dokumentu.",
      "Wybrać termin występujący wcześniej w tekście.",
      "Podać jeden termin bez informowania o rozbieżności.",
      "Wskazać rozbieżność i poprosić o ustalenie właściwego źródła przed podaniem terminu.",
    ],
    correct: "D",
    explanation:
      "Bez podstaw do rozstrzygnięcia asystent powinien ujawnić rozbieżność zamiast przedstawiać arbitralny wybór jako pewną informację.",
    checks: "Rozpoznanie sposobu postępowania ze sprzecznymi danymi.",
    reason:
      "Kandydat opisał sprzeczne dane lub błędną interpretację, ale sposób poradzenia sobie z problemem pozostaje niejasny.",
    limit:
      "Odpowiedź nie potwierdzi, że istniejący system wykrywa sprzeczności ani że kandydat go poprawił.",
  },
] as const;

export function proposeTest(report: Interview): TestQuestion[] {
  if (!/\bAI\b|model|automatyz/i.test(report.sources.description + report.sources.summary))
    return [];
  const coverage = reportCoverage(report);
  const replies = report.turns
    .filter((turn) => !isSituationalQuestion(turn.question))
    .flatMap((turn) => (turn.reply ?? "").split(/(?<=[.!?])\s+|\n+/))
    .filter(
      (reply) => !/nie wiem|nie pamiętam|nie testow|nie sprawdz|hipotetycz|gdybym/i.test(reply),
    );
  return catalog
    .flatMap(({ area, trigger, gapPattern, ...question }) => {
      const gap = coverage.find((item) => item.id === area);
      const sourceQuote = replies.find((reply) => trigger.test(reply));
      return gap &&
        !gap.covered &&
        gap.missingLabels.some((label) => gapPattern.test(label)) &&
        sourceQuote
        ? [
            {
              ...question,
              options: [...question.options],
              sourceQuote,
              valid: true,
              invalidReason: "",
            } as TestQuestion,
          ]
        : [];
    })
    .slice(0, 5);
}

export function testResult(test: OptionalTest) {
  const answered = test.questions.filter(
    (q) => q.valid && test.answers.some((a) => a.questionId === q.id && a.answer !== null),
  );
  const correct = answered.filter(
    (q) => test.answers.find((a) => a.questionId === q.id)?.answer === q.correct,
  ).length;
  return {
    correct,
    assessed: answered.length,
    total: test.questions.length,
    invalid: test.questions.filter((q) => !q.valid).length,
    unanswered: test.questions.filter(
      (q) => q.valid && !test.answers.some((a) => a.questionId === q.id && a.answer !== null),
    ).length,
  };
}
