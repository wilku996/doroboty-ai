import type { Application } from "./model";
import { reportItems, reportCoverage, type Interview } from "./interview";
import { OptionalTestPanel } from "./optional-test-panel";
import { briefExplanation } from "./interview-explanations";

export function InterviewReport({
  application,
  report,
}: {
  application: Application;
  report: Interview;
}) {
  const rows = reportItems(report);
  const coverage = report.adaptiveFrom === undefined ? [] : reportCoverage(report);
  const missing = rows.filter(
    (row) =>
      !row.reply ||
      /^(?:nie wiem|nie pamiętam|brak (?:danych|informacji)|trudno powiedzieć)[.! ]*$/i.test(
        row.reply,
      ),
  );
  return (
    <div className="interview-report">
      <h3>Raport z rozmowy</h3>
      <p>Lokalna symulacja · {report.sources.title}</p>
      <p>
        Rozmowa dokumentuje to, co osoba aplikująca powiedziała o swojej pracy. Samodzielne
        wykonanie projektu i jego wyniki wymagają niezależnego potwierdzenia.
      </p>
      <h4>Co opisano w rozmowie</h4>
      {rows
        .filter((row) => row.reply)
        .map((row, index) => (
          <section key={index}>
            <h5>{row.label}</h5>
            <p>
              <strong>Pytanie</strong>
              <br />
              {row.question}
            </p>
            <strong>Odpowiedź kandydata</strong>
            <blockquote>{row.reply}</blockquote>
            <p>
              <strong>Co oznacza odpowiedź</strong>
              <br />
              {briefExplanation(row.explanations)}
            </p>
            <details>
              <summary>Źródła i szczegóły interpretacji</summary>
              <p>
                <strong>CV</strong>
                <br />
                {row.cv || "Nie wskazano konkretnego projektu w CV."}
              </p>
              <p>
                <strong>Oferta</strong>
                <br />
                {row.role}
              </p>
              {row.explanations.map((explanation) => (
                <div key={explanation.summary}>
                  <p>
                    <strong>Fragment odpowiedzi</strong>
                    <br />
                    {explanation.quote}
                  </p>
                  <p>
                    <strong>Powiązany fragment oferty</strong>
                    <br />
                    {explanation.roleQuote ||
                      "Nie rozpoznano bezpośredniego powiązania z zapisaną ofertą. Znaczenie dla tej roli wymaga kontroli."}
                  </p>
                  <p>{explanation.summary}</p>
                  <p>{explanation.relevance}</p>
                  <p>{explanation.limit}</p>
                </div>
              ))}
            </details>
          </section>
        ))}
      {rows.every((row) => !row.reply) && <p>Wszystkie pytania zostały pominięte.</p>}
      <OptionalTestPanel key={application.id} application={application} />
      {coverage.some((area) => area.facts.length) && (
        <>
          <h4>Obszary opisane w odpowiedziach</h4>
          <p>
            Jedna odpowiedź może dotyczyć kilku obszarów. Poniżej wskazano fragmenty rozpoznane
            przez lokalną symulację; ich znaczenie wymaga kontroli osoby znającej rolę.
          </p>
          {coverage
            .filter((area) => area.facts.length)
            .map((area) => (
              <details key={area.id}>
                <summary>
                  {area.label} · {area.covered ? "rozpoznano opis" : "opis częściowy"}
                </summary>
                {area.facts.map((fact) => (
                  <p key={fact.label}>
                    <strong>
                      {fact.label} · odpowiedź {fact.turn}
                    </strong>
                    <br />
                    {fact.text}
                  </p>
                ))}
              </details>
            ))}
        </>
      )}
      <h4>Czego nie ustalono</h4>
      {coverage.length
        ? coverage
            .filter((area) => !area.covered)
            .map((area) => (
              <p key={area.id}>
                <strong>{area.label}</strong> —{" "}
                {area.skipped && !area.facts.length ? "pytanie pominięte. " : ""}
                {"Do wyjaśnienia lub kontroli: " +
                  area.missingLabels.join(", ").toLocaleLowerCase("pl") +
                  "."}
              </p>
            ))
        : missing.map((row, index) => (
            <p key={index}>
              <strong>{row.label}</strong> —{" "}
              {row.reply ? "osoba nie podała informacji." : "pytanie pominięte."}
            </p>
          ))}
      <p>
        Na podstawie tej rozmowy nie można ustalić jakości wykonanej pracy. Znaczenie wypowiedzi dla
        stanowiska jest interpretacją symulacji i wymaga sprawdzenia przez osobę znającą rolę.
      </p>
      <details>
        <summary>Pełne źródła z momentu rozmowy</summary>
        <h5>CV</h5>
        <p>{report.sources.cv}</p>
        <h5>{report.sources.title} · oferta</h5>
        <p>{report.sources.summary}</p>
        <p>{report.sources.description}</p>
        <p>Osobistą odpowiedź do formularza znajdziesz w zakładce „Odpowiedź”.</p>
      </details>
    </div>
  );
}
