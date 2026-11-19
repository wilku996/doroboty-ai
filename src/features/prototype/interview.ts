import { z } from "zod";
import marketplace from "./data/marketplace.json" with { type: "json" };
import { topicCoverage } from "./interview-coverage";
import { explainReply } from "./interview-explanations";
import { isSituationalQuestion, replacementBasic } from "./interview-ai-skills";

const source = z.string().max(12000);
const sourcesSchema = z.object({
  cv: source,
  title: z.string().min(1).max(200),
  summary: source,
  description: source,
});
export type Sources = z.infer<typeof sourcesSchema>;
export function interviewSources(cv: string, job: Omit<Sources, "cv">): Sources {
  return { cv, title: job.title, summary: job.summary, description: job.description };
}
export function sameSources(a: Sources, b: Sources) {
  return (
    a.cv === b.cv &&
    a.title === b.title &&
    a.summary === b.summary &&
    a.description === b.description
  );
}

const topics = [
  {
    id: "goal",
    label: "Cel projektu",
    ask: "Jaki problem miał rozwiązać opisany przez Ciebie projekt?",
    role: /problem|proces|potrzeb/i,
    meaning: "Pozwala zestawić problem z projektu z zadaniem opisanym w ofercie.",
  },
  {
    id: "own",
    label: "Deklarowany własny wkład",
    ask: "Za którą konkretną część pracy odpowiadasz osobiście?",
    role: /zespoł|współprac|odpowiedzial/i,
    meaning:
      "Pomaga ustalić, o którą część pracy tej osoby warto zapytać przy omawianiu obowiązków.",
  },
  {
    id: "ai",
    label: "Wybór podejścia AI",
    ask: "Co zdecydowało o sposobie wykorzystania lub pominięcia AI w tym projekcie?",
    role: /model|automatyz|sztuczn|\bAI\b/i,
    meaning: "Pozwala omówić wybór rozwiązania w kontekście pracy opisanej w ofercie.",
  },
  {
    id: "effect",
    label: "Sprawdzanie efektu",
    ask: "Jak sprawdzono efekt Twojej pracy?",
    role: /porówn|sprawdz|walidac|pomiar|mierzal|metryk/i,
    meaning:
      "Daje punkt odniesienia do rozmowy o tym, jak osoba na tej roli sprawdzi wynik swojej pracy.",
  },
  {
    id: "limits",
    label: "Błędy i ograniczenia",
    ask: "Jak poradzono sobie z konkretnym ograniczeniem projektu?",
    role: /bł[ąę]d|ogranicz|wyjątk|ryzyk|pomył/i,
    meaning: "Pomaga omówić sytuacje, w których wynik rozwiązania wymaga dodatkowej kontroli.",
  },
] as const;
const clarifications = [
  {
    id: "period",
    label: "Okres pomiaru",
    ask: "Jakiego okresu dotyczyło opisane porównanie wyników?",
    role: topics[3].role,
    meaning: "Okres pomiaru pomaga zrozumieć, jak porównano efekty pracy.",
    trigger: /porówn\S* .{0,35}(?:wynik|czas|efekt)|przed i po wdroż/i,
    denied: /\b(?:nie porówn|brak porówn)/i,
    resolved:
      /okres|tygod|tydzi|miesi|kwarta|(?:\d+|kilka|dwa|trzy) dni|dzień|codzien|od .+ do |w (styczniu|lutym|marcu|roku)/i,
  },
  {
    id: "decision",
    label: "Podział decyzji",
    ask: "Która decyzja w opisanej pracy zespołowej należała do Ciebie?",
    role: topics[1].role,
    meaning: "Pozwala doprecyzować podział odpowiedzialności w zespole.",
    trigger: /zdecydowaliśmy|zdecydowałyśmy|wspólnie podję|razem wybra/i,
    denied: /\bnie (?:zdecydowali|zdecydowały|podjęli|podjęły)/i,
    resolved:
      /samodziel|osobiście|moj[aąe] decyzj|wybrał[ae]m|decydował[ae]m|odpowiadał[ae]m za wybór|nie (?:podejm|decyd)/i,
  },
  {
    id: "handoff",
    label: "Przekazanie sprawy człowiekowi",
    ask: "Co uruchamiało opisane przekazanie sprawy człowiekowi?",
    role: /kontrol|wyjątk|weryfik|ryzyk|bezpiecz/i,
    meaning: "Warunek przekazania pomaga zrozumieć granice automatyzacji w tej pracy.",
    trigger: /(?:przekaz|kierowa|trafia)\S* .{0,40}(?:człowiek|operator|konsultant)/i,
    denied: /\b(?:nie (?:było przekaz|przekaz|kierowa|trafia)|bez (?:udziału|przekaz))/i,
    resolved:
      /gdy|kiedy|jeśli|jeżeli|w razie|poniżej|powyżej|w przypadku|przy .{0,30}(błęd|brak|ryzyk)|zawsze|każd/i,
  },
] as const;
function resolvedDetail(id: string, text: string) {
  if (id === "period")
    return /(?:\d+|dwa|dwie|trzy|cztery|kilka)\s*(?:dni|tygod|miesi|kwarta)|tydzień|miesiąc|od .{0,35} do /i.test(
      text,
    );
  if (id === "decision")
    return /(?:wybrał[ae]m|zdecydował[ae]m|ustalił[ae]m).{3,100}(?:zakres|tylko|zamiast|wersj|klasyfik|metod)|nie (?:podejm|decyd)/i.test(
      text,
    );
  return /(?:gdy|kiedy|jeśli|jeżeli|w razie|w przypadku|przy).{0,80}(?:błęd|brak|ryzyk|niepewn|nie (?:zna|rozpozna|potraf)|kwot|danych)|poniżej\s*\d|powyżej\s*\d|zawsze|każd/i.test(
    text,
  );
}
type Question = {
  id: string;
  label: string;
  ask: string;
  role: RegExp;
  meaning: string;
  plannedPrompt?: string;
  context?: { text: string; turn: number };
};
export function isBasicQuestion(id: string) {
  return topics.some((topic) => topic.id === id);
}
// Each cue must occur in the approved offer before its role criterion can be used.
const roleCriteria = [
  {
    cue: "porównacie wynik z punktem wyjścia",
    task: "W tej ofercie zespół wybiera proces finansowy do pilotażu.",
    goal: "Który problem w Twoim projekcie uzasadniał rozpoczęcie prac?",
    effect: "Jak sprawdzono zmianę względem sytuacji sprzed wdrożenia?",
    meaning: "W tej roli trzeba porównać wynik pilotażu z sytuacją sprzed wdrożenia.",
  },
  {
    cue: "zestawy ewaluacyjne",
    task: "Zespół tworzy system wspierający dokumentację kliniczną.",
    goal: "Jaki problem użytkownika próbował rozwiązać Twój projekt?",
    effect: "Jak sprawdzono poprawność wyników na przykładach z projektu?",
    meaning: "Ta rola wymaga sprawdzania wyników systemu na przygotowanych przykładach.",
  },
  {
    cue: "rozmowy i testy",
    task: "Zadaniem projektanta jest sprawdzenie, kiedy użytkownik korzysta z podpowiedzi, a kiedy ją poprawia.",
    goal: "Jaką trudność użytkownika miał usunąć Twój projekt?",
    effect: "Jak sprawdzono efekt projektu z perspektywy użytkownika?",
    meaning: "W tej pracy trzeba sprawdzić, jak ludzie korzystają z wdrożonego rozwiązania.",
  },
  {
    cue: "nietypowy przypadek",
    task: "Osoba w tej roli automatyzuje powtarzalne procesy i pomaga zespołowi obsługiwać wyjątki.",
    goal: "Który problem w codziennej pracy miał rozwiązać Twój projekt?",
    effect: "Jak oceniono poprawność wyników Twojego procesu?",
    meaning: "Oferta wymaga sprawdzania treści przygotowanej przez model i rozpoznawania wyjątków.",
  },
  {
    cue: "zaplanujesz eksperymenty",
    task: "Zespół wybiera grupę odbiorców i sprawdza sposoby dotarcia do niej.",
    goal: "Jaką potrzebę odbiorców miał zaspokoić Twój projekt?",
    effect: "Jak sprawdzono efekt projektu wśród jego odbiorców?",
    meaning: "W tej roli trzeba ocenić, co wynik eksperymentu mówi o zachowaniu odbiorców.",
  },
  {
    cue: "dobór metryk do kosztu pomyłki",
    task: "Zespół wdraża funkcje uczenia maszynowego w produktach klientów.",
    goal: "Jaki problem miał rozwiązać wybrany przez Ciebie projekt?",
    effect: "Jak sprawdzono skutki pomyłek w Twoim rozwiązaniu?",
    meaning: "Osoba na tym stanowisku ma dobrać sposób pomiaru do konsekwencji błędu.",
  },
];
function roleCriterion(s: Sources) {
  // Prepared explanations describe the original published offer. A customized
  // offer may reuse one phrase while changing the surrounding responsibilities.
  const prepared = marketplace.jobs.find(
    (job) =>
      job.title === s.title && job.description === s.description && job.summary === s.summary,
  );
  return prepared && roleCriteria.find((c) => s.description.toLowerCase().includes(c.cue));
}
export const replySchema = z.string().trim().min(1).max(2000);
const interviewData = z.object({
  version: z.literal(1),
  adaptiveFrom: z.number().int().min(0).max(8).optional(),
  detailFrom: z.number().int().min(0).max(8).optional(),
  aiFrom: z.number().int().min(0).max(8).optional(),
  fiveFrom: z.number().int().min(0).max(8).optional(),
  sources: sourcesSchema,
  turns: z
    .array(
      z.object({
        id: z.string().max(20),
        reply: replySchema.nullable(),
        question: z.string().min(1).max(2000).optional(),
      }),
    )
    .max(8),
});
export type Interview = z.infer<typeof interviewData>;

function fragments(text: string) {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[-\s]+/, "").trim())
    .filter((s) => s && !s.startsWith("#"));
}
export function evidence(s: Sources, q: Question) {
  const lines = fragments(s.cv);
  const project =
    lines.find((x) => /wdroż|automatyz|projekt|zbudow|opracowa|stworzy/i.test(x)) ?? "";
  const metric = lines.find((x) => /\d+(?:[.,]\d+)?\s*%/.test(x));
  const cv = q.id === "effect" && metric ? metric : project;
  const criterion = roleCriterion(s);
  const passages = fragments(s.description);
  const criterionQuote =
    (q.id === "effect" || q.id === "period") && criterion
      ? passages.find((x) => x.toLowerCase().includes(criterion.cue))
      : undefined;
  const role = criterionQuote ?? passages.find((x) => q.role.test(x)) ?? s.summary;
  return { cv, role };
}
export function prompt(s: Sources, q: Question, legacy = false) {
  if (q.plannedPrompt) return q.plannedPrompt;
  const { cv } = evidence(s, q);
  const criterion = roleCriterion(s);
  if (q.id === "goal" && !legacy) {
    if (!cv)
      return "Wybierz własny projekt związany z tą ofertą. Na jakiej podstawie uznano jego problem za wart rozwiązania?";
    const study = cv.match(/badania z (\d+) użytkownikami/i);
    if (study && /asystenta do zgłoszeń/i.test(cv)) {
      return (
        "W CV wspominasz o badaniach z " +
        study[1] +
        " użytkownikami. Jak przeprowadziłaś te badania, żeby ustalić, w czym asystent miał im pomagać?"
      );
    }
    return "W CV opisujesz ten projekt. Na jakiej podstawie uznano jego problem za wart rozwiązania?";
  }
  if (q.id === "goal")
    return cv
      ? (criterion?.goal ?? q.ask)
      : "Wybierz własny projekt związany z tą ofertą. Jaki problem miał rozwiązać?";
  if (q.id === "effect") {
    const metric = cv.match(/\d+(?:[.,]\d+)?\s*%/)?.[0];
    if (metric) return "Jak ustalono podany w CV wynik " + metric + "?";
    if (criterion) return criterion.effect;
  }
  return q.ask;
}
function legacyNextQuestion({ sources, turns }: Interview): Question | undefined {
  if (turns.length < topics.length) return topics[turns.length];
  const replies = turns.flatMap((t) => (t.reply ? [t.reply] : []));
  if (!replies.length) return undefined;
  return clarifications.find(
    (q) =>
      !turns.some((t) => t.id === q.id) &&
      q.role.test(sources.description + " " + sources.summary) &&
      (replies.some((r) => q.trigger.test(r)) ||
        (q.id === "handoff" && q.trigger.test(sources.cv) && !q.denied.test(sources.cv))) &&
      !replies.some((r) => q.denied.test(r)) &&
      !replies.some((r) => q.resolved.test(r)),
  );
}
export function nextQuestion(interview: Interview): Question | undefined {
  const { sources, turns, adaptiveFrom } = interview;
  if (adaptiveFrom === undefined || turns.length < adaptiveFrom)
    return legacyNextQuestion(interview);
  if (turns.length >= 8) return undefined;
  const coverage = topicCoverage(interview);
  const practicalAI = interview.aiFrom !== undefined && turns.length >= interview.aiFrom;
  const fiveBasics = interview.fiveFrom !== undefined && turns.length >= interview.fiveFrom;
  for (const topic of topics) {
    const area = coverage.find((item) => item.id === topic.id)!;
    if (area.covered || !area.missing.length || turns.some((turn) => turn.id === topic.id))
      continue;
    if (interview.detailFrom !== undefined && turns.length >= interview.detailFrom)
      return { ...topic, plannedPrompt: area.missing[0].ask, context: area.facts[0] };
    return area.facts.length
      ? { ...topic, plannedPrompt: area.missing[0].ask, context: area.facts[0] }
      : topic;
  }
  if (fiveBasics) {
    const topic = topics.find((item) => !turns.some((turn) => turn.id === item.id));
    if (topic)
      return {
        ...topic,
        plannedPrompt: replacementBasic(interview, topic.id),
        context: coverage.find((area) => area.id === topic.id)?.facts[0],
      };
  }
  if (turns.filter((turn) => !isBasicQuestion(turn.id)).length >= 3) return undefined;
  for (const topic of topics) {
    const area = coverage.find((item) => item.id === topic.id)!;
    const answered = turns.find((turn) => turn.id === topic.id);
    const id = "detail_" + topic.id;
    const missing = practicalAI
      ? area.missing.find((detail) => !turns.some((turn) => turn.question === detail.ask))
      : area.missing[0];
    if (
      !area.covered &&
      missing &&
      area.facts.length &&
      answered?.reply &&
      !/nie wiem|nie pamiętam|nie chcę|odmawiam|brak informacji/i.test(answered.reply) &&
      !turns.some((turn) => turn.id === id)
    ) {
      return { ...topic, id, plannedPrompt: missing.ask, context: area.facts[0] };
    }
  }
  if (practicalAI) return undefined;
  const replies = turns.flatMap((turn, index) =>
    turn.reply ? [{ text: turn.reply, turn: index + 1 }] : [],
  );
  for (const clarification of clarifications) {
    const detailed = interview.detailFrom !== undefined && turns.length >= interview.detailFrom;
    // The own-contribution prompt already asks for a concrete decision in this case.
    if (
      detailed &&
      clarification.id === "decision" &&
      (coverage.find((area) => area.id === "own")?.covered ||
        turns.some((turn) => turn.id === "own" && /decyzj/i.test(turn.question ?? "")))
    )
      continue;
    const context = replies.find((reply) => clarification.trigger.test(reply.text));
    const relevantReplies = replies.filter(
      (reply) =>
        clarification.trigger.test(reply.text) ||
        turns[reply.turn - 1].id === clarification.id ||
        (clarification.id === "period" &&
          /pomiar|mierzy|mierzen|porówn|okres badani/i.test(reply.text)) ||
        (clarification.id === "decision" && /decyd|decyzj|wybra|wybór/i.test(reply.text)) ||
        (clarification.id === "handoff" && /przekaz|kierowa|trafia/i.test(reply.text)),
    );
    if (
      context &&
      clarification.role.test(sources.description + " " + sources.summary) &&
      !turns.some((turn) => turn.id === clarification.id) &&
      !replies.some((reply) => clarification.denied.test(reply.text)) &&
      ![
        ...relevantReplies.map((reply) => reply.text),
        ...(detailed
          ? fragments(sources.cv).filter((text) => clarification.trigger.test(text))
          : []),
      ].some((text) =>
        detailed ? resolvedDetail(clarification.id, text) : clarification.resolved.test(text),
      )
    )
      return { ...clarification, context };
  }
  return undefined;
}
export const interviewSchema = interviewData.refine(
  (i) =>
    (i.adaptiveFrom === undefined || i.adaptiveFrom <= i.turns.length) &&
    (i.detailFrom === undefined ||
      (i.adaptiveFrom !== undefined &&
        i.detailFrom >= i.adaptiveFrom &&
        i.detailFrom <= i.turns.length)) &&
    (i.aiFrom === undefined ||
      (i.detailFrom !== undefined && i.aiFrom >= i.detailFrom && i.aiFrom <= i.turns.length)) &&
    (i.fiveFrom === undefined ||
      (i.aiFrom !== undefined && i.fiveFrom >= i.aiFrom && i.fiveFrom <= i.turns.length)) &&
    i.turns.every(
      (t, index) => nextQuestion({ ...i, turns: i.turns.slice(0, index) })?.id === t.id,
    ),
  "Invalid interview sequence",
);
export const completedInterviewSchema = interviewSchema.refine(
  (i) => !nextQuestion(i),
  "Incomplete interview",
);
export const reviewSchema = z.object({
  reviewer: z.string().trim().min(1).max(200),
  minutes: z.number().int().positive().max(1440),
  corrections: z.string().trim().max(2000),
});
export function reportItems(i: Interview) {
  const aiMeanings: Record<string, string> = {
    goal: "Pomaga omówić, jak sprawdzano przydatność AI do zadania przed wdrożeniem.",
    own: "Pomaga odróżnić znajomość instrukcji modelu od deklaracji własnej pracy nad nimi.",
    ai: "Pomaga omówić dobór informacji dla AI i sprawdzanie źródeł jego odpowiedzi.",
    effect: "Pomaga omówić sposób wykrywania niepoprawnych odpowiedzi AI przed użyciem w pracy.",
    limits: "Pomaga omówić rozpoznanie błędu modelu i zmianę wprowadzoną po jego wykryciu.",
  };
  return i.turns.map((t, index) => {
    const q = [...topics, ...clarifications].find((x) => x.id === t.id.replace(/^detail_/, ""))!;
    const criterion = roleCriterion(i.sources);
    const meaning =
      q.id === "effect" || q.id === "period"
        ? (criterion?.meaning ?? q.meaning)
        : ((q.id === "goal" || q.id === "own") && criterion ? criterion.task + " " : "") +
          q.meaning;
    return {
      ...evidence(i.sources, q),
      question: t.question ?? prompt(i.sources, q, true),
      label: q.label,
      meaning:
        i.aiFrom !== undefined && index >= i.aiFrom
          ? (aiMeanings[q.id] ?? meaning)
          : q.id === "goal" && t.question?.includes("Jak przeprowadziłaś te badania")
            ? "Pozwala zrozumieć, jak osoba aplikująca poznawała potrzeby użytkowników i ustalała zakres asystenta. Rekruter może zestawić opisany sposób pracy z zadaniami badawczymi w ofercie."
            : q.id === "goal" && t.question
              ? "Pozwala sprawdzić, na jakiej podstawie wybrano problem do rozwiązania. Rekruter może zestawić tę decyzję z zadaniem opisanym w ofercie."
              : meaning,
      reply: t.reply,
      situational: isSituationalQuestion(t.question),
      explanations: isSituationalQuestion(t.question) ? [] : explainReply(t.reply, i.sources),
    };
  });
}

export function reportCoverage(interview: Interview) {
  return topicCoverage(interview).map((original) => {
    const recognized = interview.turns.flatMap((turn, index) =>
      explainReply(
        isSituationalQuestion(turn.question) ? null : turn.reply,
        interview.sources,
      ).flatMap((explanation) =>
        (explanation.evidenceLabels ?? [])
          .filter((label) => original.missing.some((detail) => detail.label === label))
          .map((label) => ({ label, text: explanation.quote, turn: index + 1 })),
      ),
    );
    const facts = [...original.facts, ...recognized].filter(
      (fact, index, all) => all.findIndex((other) => other.label === fact.label) === index,
    );
    const missing = original.missing.filter(
      (detail) => !facts.some((fact) => fact.label === detail.label),
    );
    const area = {
      ...original,
      facts,
      missing,
      covered: original.covered || (facts.length > 0 && missing.length === 0),
    };
    return {
      ...area,
      label: topics.find((topic) => topic.id === area.id)!.label,
      skipped: interview.turns.some((turn) => turn.id === area.id && turn.reply === null),
      missingLabels:
        !area.covered && !area.missing.length
          ? ["Brak podstaw do nowego pytania poza informacjami z CV w lokalnej symulacji."]
          : area.missing.map((detail) => detail.label),
    };
  });
}
