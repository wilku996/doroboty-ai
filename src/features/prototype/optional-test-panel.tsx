import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Application } from "./model";
import {
  letters,
  proposeTest,
  testResult,
  testInvitationSchema,
  type OptionalTest,
  type TestQuestion,
} from "./optional-test";
import { usePrototype } from "./store";

function Result({ test }: { test: OptionalTest }) {
  const result = testResult(test);
  return (
    <section aria-label="Uzupełnienie raportu po teście">
      <h5>Uzupełnienie po teście</h5>
      <p>
        {result.assessed
          ? `${result.correct} ${result.correct === 1 ? "poprawna odpowiedź" : result.correct >= 2 && result.correct <= 4 ? "poprawne odpowiedzi" : "poprawnych odpowiedzi"} z ${result.assessed} ${result.assessed === 1 ? "ocenianej" : "ocenianych"} (${Math.round((result.correct / result.assessed) * 100)}%).`
          : "Brak wyniku — nie ma odpowiedzi na pytania z ważnym kluczem."}
      </p>
      <p>
        Wszystkie zadane pytania: {result.total}. Ważne pytania bez odpowiedzi: {result.unanswered}.
        Unieważnione: {result.invalid}. Odpowiedzi bez ważnego klucza nie są oceniane.
      </p>
      <p>
        Wynik dotyczy tylko tego zestawu. Nie oznacza stopnia opanowania AI i nie służy do
        porównywania kandydatów rozwiązujących różne zestawy.
      </p>
      {test.questions.map((q, index) => (
        <details key={q.id}>
          <summary>
            Pytanie {index + 1} · {q.valid ? "pytanie oceniane" : "unieważnione"}
          </summary>
          <p>{q.question}</p>
          <p>Odpowiedź: {test.answers.find((a) => a.questionId === q.id)?.answer ?? "brak"}.</p>
          {q.valid ? (
            <p>
              Klucz: {q.correct}. {q.explanation}
            </p>
          ) : (
            <p>Powód unieważnienia: {q.invalidReason}</p>
          )}
        </details>
      ))}
    </section>
  );
}

export function OptionalTestPanel({ application }: { application: Application }) {
  const { run } = usePrototype();
  const proposals = application.report ? proposeTest(application.report) : [];
  const [questions, setQuestions] = useState(proposals);
  const [included, setIncluded] = useState(proposals.map((q) => q.id));
  const [invalidReason, setInvalidReason] = useState("");
  const [notice, setNotice] = useState("");
  const test = application.optionalTest;
  const invited = test && test.status !== "skipped";
  function edit(id: string, changes: Partial<TestQuestion>) {
    setQuestions((items) => items.map((q) => (q.id === id ? { ...q, ...changes } : q)));
  }
  return (
    <section className="interview-review" aria-label="Dodatkowy test A–D">
      <h4>Dodatkowy test A–D</h4>
      <p>
        <strong>Rekomendacja asystenta · lokalna symulacja</strong>
      </p>
      <p>
        {proposals.length
          ? `Warto rozważyć krótki test. Liczba proponowanych pytań: ${proposals.length}. Dotyczą sprawdzalnych kwestii, których rozmowa nie wyjaśniła. Poniżej zobaczysz pytania przed podjęciem decyzji.`
          : "Nie proponuję dodatkowego testu. Nie rozpoznano niewiadomej, którą dostępne pytania A–D mogłyby rzetelnie wyjaśnić. Brak opisu własnego wkładu wymaga rozmowy lub materiału z pracy, a nie testu wyboru."}
      </p>
      <p>
        Propozycja obejmuje 1–5 pytań, gdy są podstawy. Decyzję podejmuje rekruter. Brak decyzji nie
        uruchamia testu.
      </p>
      {invited ? (
        <>
          <p role="status">
            {test.status === "invited"
              ? "Zaproszenie do testu zapisane. Oczekiwanie na dobrowolną odpowiedź kandydata."
              : test.status === "declined"
                ? "Kandydat odmówił testu. Brak wyniku; odmowa nie jest zerową oceną umiejętności."
                : "Kandydat przesłał odpowiedzi. Wynik uzupełnia raport."}
          </p>
          {test.review && (
            <p>
              Wcześniej zapisana kontrola pytań: {test.review.reviewer} · {test.review.minutes} min.
            </p>
          )}
          {test.status === "submitted" && <Result test={test} />}
          <details>
            <summary>Pytania i klucz zatwierdzonego testu</summary>
            {test.questions.map((q, index) => (
              <section key={q.id}>
                <h5>Pytanie {index + 1}</h5>
                <p>{q.question}</p>
                {q.options.map((option, i) => (
                  <p key={letters[i]}>
                    {letters[i]}. {option}
                  </p>
                ))}
                <p>
                  Klucz: {q.correct}. {q.explanation}
                </p>
                {q.valid ? (
                  <Button
                    variant="outline"
                    disabled={!invalidReason.trim()}
                    onClick={() =>
                      run({
                        type: "test_invalidate",
                        applicationId: application.id,
                        questionId: q.id,
                        reason: invalidReason,
                      })
                    }
                  >
                    Unieważnij pytanie {index + 1}
                  </Button>
                ) : (
                  <p>Unieważnione: {q.invalidReason}</p>
                )}
              </section>
            ))}
            <label className="field">
              Powód unieważnienia pytania
              <Textarea
                maxLength={2000}
                value={invalidReason}
                onChange={(e) => setInvalidReason(e.target.value)}
              />
            </label>
          </details>
        </>
      ) : (
        <>
          {test?.status === "skipped" && (
            <p role="status">Zapisano decyzję: dalej bez testu. Możesz wrócić do propozycji.</p>
          )}
          {questions.map((q, index) => (
            <section key={q.id}>
              <h5>Podgląd pytania {index + 1}</h5>
              <label className="application-consent">
                <Checkbox
                  checked={included.includes(q.id)}
                  onCheckedChange={(checked) => {
                    setIncluded((ids) =>
                      checked ? [...ids, q.id] : ids.filter((id) => id !== q.id),
                    );
                  }}
                />
                <span>Uwzględnij pytanie {index + 1} w teście</span>
              </label>
              <p>{q.question}</p>
              {q.options.map((option, i) => (
                <p key={letters[i]}>
                  {letters[i]}. {option}
                </p>
              ))}
              <p>
                <strong>Co sprawdza</strong>
                <br />
                {q.checks}
              </p>
              <p>
                <strong>Dlaczego po tej rozmowie</strong>
                <br />
                {q.reason}
              </p>
              <blockquote>{q.sourceQuote}</blockquote>
              <p>
                <strong>Czego nie potwierdzi</strong>
                <br />
                {q.limit}
              </p>
              <details>
                <summary>Klucz i poprawki · tylko rekruter</summary>
                <p>
                  Poprawna odpowiedź: {q.correct}. {q.explanation}
                </p>
                <label className="field">
                  Treść pytania {index + 1}
                  <Textarea
                    value={q.question}
                    maxLength={2000}
                    onChange={(e) => edit(q.id, { question: e.target.value })}
                  />
                </label>
                {q.options.map((option, i) => (
                  <label className="field" key={letters[i]}>
                    Odpowiedź {letters[i]} · pytanie {index + 1}
                    <Input
                      value={option}
                      maxLength={2000}
                      onChange={(e) => {
                        const options = [...q.options] as TestQuestion["options"];
                        options[i] = e.target.value;
                        edit(q.id, { options });
                      }}
                    />
                  </label>
                ))}
                <label className="field">
                  Klucz · pytanie {index + 1}
                  <select
                    value={q.correct}
                    onChange={(e) =>
                      edit(q.id, { correct: e.target.value as TestQuestion["correct"] })
                    }
                  >
                    {letters.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Wyjaśnienie klucza · pytanie {index + 1}
                  <Textarea
                    value={q.explanation}
                    maxLength={2000}
                    onChange={(e) => edit(q.id, { explanation: e.target.value })}
                  />
                </label>
              </details>
            </section>
          ))}
          <div className="record-actions">
            {!!questions.length && (
              <Button
                disabled={
                  !testInvitationSchema.safeParse({
                    questions: questions.filter((q) => included.includes(q.id)),
                  }).success
                }
                onClick={() => {
                  if (
                    run({
                      type: "test_invite",
                      applicationId: application.id,
                      value: {
                        questions: questions.filter((q) => included.includes(q.id)),
                      },
                    })
                  )
                    setNotice("Zapisano oddzielne zaproszenie do testu.");
                }}
              >
                Zaproś do krótkiego testu
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (run({ type: "test_skip", applicationId: application.id }))
                  setNotice("Zapisano decyzję: dalej bez testu.");
              }}
            >
              Przejdź dalej bez testu
            </Button>
          </div>
        </>
      )}
      <p>
        W prototypie zaproszenie pojawia się w aplikacji kandydata w tej przeglądarce. Nie jest
        wysyłany e-mail. Decyzja o teście nie zmienia etapu rekrutacji.
      </p>
      <p role="status">{notice}</p>
    </section>
  );
}

export function CandidateOptionalTest({ application }: { application: Application }) {
  const { run } = usePrototype();
  const test = application.optionalTest;
  if (!test || test.status === "skipped") return null;
  return (
    <section className="interview-review" aria-label="Zaproszenie do krótkiego testu">
      <h3>Krótki test A–D</h3>
      {test.status === "declined" ? (
        <p>Odmówiono udziału. Nie ustalono wyniku.</p>
      ) : test.status === "submitted" ? (
        <Result test={test} />
      ) : (
        <>
          <p>
            Rekruter zaprasza Cię do dobrowolnego, dodatkowego testu. Możesz pominąć pytania lub
            odmówić. Wynik uzupełni raport dla firmy, do której aplikujesz.
          </p>
          {test.questions.map((q, index) => (
            <fieldset key={q.id} disabled={!q.valid}>
              <legend>
                Pytanie {index + 1}. {q.question}
              </legend>
              {!q.valid && <p>Pytanie unieważnione — nie będzie oceniane.</p>}
              {q.options.map((option, i) => (
                <label className="application-consent" key={letters[i]}>
                  <input
                    type="radio"
                    name={q.id}
                    value={letters[i]}
                    checked={test.answers.find((a) => a.questionId === q.id)?.answer === letters[i]}
                    onChange={() =>
                      run({
                        type: "test_answers",
                        applicationId: application.id,
                        answers: [
                          ...test.answers.filter((a) => a.questionId !== q.id),
                          { questionId: q.id, answer: letters[i] },
                        ],
                        submit: false,
                      })
                    }
                  />
                  <span>
                    {letters[i]}. {option}
                  </span>
                </label>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  run({
                    type: "test_answers",
                    applicationId: application.id,
                    answers: test.answers.filter((a) => a.questionId !== q.id),
                    submit: false,
                  })
                }
              >
                Pozostaw pytanie {index + 1} bez odpowiedzi
              </Button>
            </fieldset>
          ))}
          <div className="record-actions">
            <Button
              onClick={() =>
                run({
                  type: "test_answers",
                  applicationId: application.id,
                  answers: test.answers,
                  submit: true,
                })
              }
            >
              Prześlij odpowiedzi do testu
            </Button>
            <Button
              variant="outline"
              onClick={() => run({ type: "test_decline", applicationId: application.id })}
            >
              Odmów udziału w teście
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
