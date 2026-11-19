import { useRef, useState, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  evidence,
  isBasicQuestion,
  nextQuestion,
  prompt,
  reportItems,
  sameSources,
  type Interview,
  type Sources,
} from "./interview";
import { usePrototype } from "./store";

type Props = {
  jobId: string;
  company: string;
  sources: Sources;
  interview?: Interview;
  applicationAnswer: string;
  attached: boolean;
  onAttach: (value: boolean) => void;
};
export function InterviewPanel({
  jobId,
  company,
  sources,
  interview,
  applicationAnswer,
  attached,
  onAttach,
}: Props) {
  const { run, issue } = usePrototype();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef(false);
  const stale = interview && !sameSources(sources, interview.sources);
  const question = interview && nextQuestion(interview);
  const active = open && !stale && question && interview;
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    (active || !trigger.current ? heading.current : trigger.current)?.focus();
    pendingFocus.current = false;
  }, [active, open, interview]);
  function start() {
    if (run({ type: "interview_start", jobId, answer: applicationAnswer })) {
      pendingFocus.current = true;
      setOpen(true);
      if (stale || !interview) setReply("");
      onAttach(false);
    }
  }
  function record(value: string | null) {
    if (!interview || !question) return;
    if (
      run({
        type: "interview_reply",
        jobId,
        answer: applicationAnswer,
        position: interview.turns.length,
        questionId: question.id,
        reply: value,
      })
    ) {
      pendingFocus.current = true;
      setReply("");
    }
  }
  const context = active && evidence(sources, question);
  return (
    <section
      className="application-form-section interview-panel"
      aria-labelledby="verification-heading"
    >
      <h3 id="verification-heading" ref={heading} tabIndex={-1}>
        {active ? prompt(sources, question) : "Zweryfikuj się"}
      </h3>
      {active && context ? (
        <>
          <p className="application-help">
            {"Pytanie " + (interview.turns.length + 1) + " z maks. 8 · "}
            {isBasicQuestion(question.id)
              ? "Obszar podstawowy"
              : "Dopytanie " +
                (interview.turns.filter((turn) => !isBasicQuestion(turn.id)).length + 1) +
                " z maks. 3"}{" "}
            · {question.label}
          </p>
          {question.context && (
            <p>
              <strong>Twoja wcześniejsza odpowiedź · pytanie {question.context.turn}</strong>
              <br />
              {question.context.text}
            </p>
          )}
          {context.cv && (
            <p>
              <strong>Fragment CV</strong>
              <br />
              {context.cv}
            </p>
          )}
          <p>
            <strong>{sources.title} · fragment oferty</strong>
            <br />
            {context.role}
          </p>
          <label className="field">
            <span>Twoja odpowiedź</span>
            <Textarea
              rows={4}
              maxLength={2000}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
          <div className="application-actions">
            <Button type="button" disabled={!reply.trim()} onClick={() => record(reply)}>
              Zatwierdź odpowiedź
            </Button>
            <Button type="button" variant="outline" onClick={() => record(null)}>
              Pomiń pytanie
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                pendingFocus.current = true;
                setOpen(false);
              }}
            >
              Wróć do formularza
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            W dobrowolnej rozmowie opiszesz swoją pracę nad projektem. Lokalna symulacja asystenta
            uwzględnia Twoje wcześniejsze odpowiedzi i pięć obszarów rozmowy. Obszary już opisane
            może pominąć. Zada maksymalnie 8 pytań, w tym do 3 dopytań. Po wysłaniu aplikacji
            rekruter firmy {company} otrzyma raport, jeśli go dołączysz.
          </p>
          {stale && (
            <p>
              CV lub oferta zmieniły się od rozpoczęcia rozmowy. Możesz zacząć od nowa albo wysłać
              aplikację bez raportu.
            </p>
          )}
          {interview && !question && !stale ? (
            <>
              <p>
                <strong>Rozmowa zakończona.</strong>{" "}
                {issue
                  ? "Odpowiedzi są dostępne w tej sesji. Sprawdź komunikat o zapisie przed zamknięciem strony."
                  : "Zapisano odpowiedzi i pominięte pytania."}
              </p>
              <details>
                <summary>Przeczytaj zapis rozmowy</summary>
                {reportItems(interview).map((row, index) => (
                  <p key={index}>
                    <strong>{row.question}</strong>
                    <br />
                    {row.reply ?? "Pominięto pytanie."}
                  </p>
                ))}
              </details>
              <label className="application-consent">
                <Checkbox checked={attached} onCheckedChange={(v) => onAttach(v === true)} />
                <span>Dołącz raport z rozmowy do aplikacji</span>
              </label>
            </>
          ) : (
            <Button ref={trigger} type="button" variant="outline" onClick={start}>
              {stale
                ? "Rozpocznij na aktualnych źródłach"
                : interview
                  ? "Wznów rozmowę"
                  : "Zweryfikuj się"}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
