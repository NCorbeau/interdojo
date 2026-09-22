"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { companyWorlds, getCompanyWorld } from "@/lib/company-worlds";
import { allExercises, allSkills } from "@/lib/exercise-bank";
import type {
  AnswerExample,
  AnchorExercise,
  Attempt,
  CompanyId,
  CompletedSession,
  Exercise,
  OrderingExercise,
  PhaseOneSessionMode,
  SessionMode,
} from "@/lib/domain";
import {
  buildSessionExercises,
  makeAttempt,
  summarizeSession,
} from "@/lib/session";
import { isCompletedSession } from "@/lib/session-validation";

const LOCAL_HISTORY_KEY = "interdojo:sessions:v1";
const LEGACY_LOCAL_HISTORY_KEY = "interview-arcade:sessions:v1";
const LAST_COMPANY_KEY = "interdojo:last-company:v1";

type Screen = "home" | "session" | "results";

const modes: Array<{
  id: PhaseOneSessionMode;
  kicker: string;
  title: string;
  description: string;
  duration: string;
  accent: string;
}> = [
  {
    id: "daily",
    kicker: "Recommended",
    title: "Daily Sprint",
    description: "A fast mix of technical judgment and interview structure.",
    duration: "7 drills · 8 min",
    accent: "lime",
  },
  {
    id: "engineering",
    kicker: "Deepen the model",
    title: "Engineering",
    description: "Failures, runtime behavior and system-design trade-offs.",
    duration: "7 drills · 10 min",
    accent: "cyan",
  },
  {
    id: "interview",
    kicker: "Sharpen the signal",
    title: "Interview",
    description: "Anchors, claim boundaries and concise answer structure.",
    duration: "7 drills · 7 min",
    accent: "coral",
  },
];

function getSessionLabel(mode: SessionMode, companyId?: CompanyId) {
  if (mode === "company" || mode === "rapid-fire") {
    const companyName = companyId ? getCompanyWorld(companyId).name : "Company";
    return mode === "rapid-fire"
      ? `${companyName} · Rapid Fire`
      : `${companyName} · World`;
  }

  return modes.find((candidate) => candidate.id === mode)?.title ?? "Training";
}

function getSkillName(skillId: string) {
  return allSkills.find((skill) => skill.id === skillId)?.name;
}

function Icon({ name }: { name: "bolt" | "code" | "voice" | "arrow" | "check" }) {
  const paths = {
    bolt: "M13 2 4.5 13H11l-1 9L19.5 11H13l0-9Z",
    code: "m8 9-4 3 4 3m8-6 4 3-4 3m-3-8-2 10",
    voice: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0m-7 7v3m-4 0h8",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    check: "m5 12 4 4L19 6",
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function loadLocalHistory(): CompletedSession[] {
  try {
    const currentHistory = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (currentHistory) {
      const parsed: unknown = JSON.parse(currentHistory);
      return Array.isArray(parsed) ? parsed.filter(isCompletedSession) : [];
    }

    const legacyHistory = localStorage.getItem(LEGACY_LOCAL_HISTORY_KEY);
    if (!legacyHistory) return [];

    localStorage.setItem(LOCAL_HISTORY_KEY, legacyHistory);
    const parsed: unknown = JSON.parse(legacyHistory);
    return Array.isArray(parsed) ? parsed.filter(isCompletedSession) : [];
  } catch {
    return [];
  }
}

async function persistSession(session: CompletedSession) {
  const localHistory = loadLocalHistory();
  localStorage.setItem(
    LOCAL_HISTORY_KEY,
    JSON.stringify([session, ...localHistory].slice(0, 30)),
  );

  try {
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(session),
    });
  } catch {
    // Local history remains usable when the Cloudflare D1 binding is unavailable.
  }
}

function ModeIcon({ mode }: { mode: PhaseOneSessionMode }) {
  return (
    <span className="mode-icon">
      <Icon name={mode === "daily" ? "bolt" : mode === "engineering" ? "code" : "voice"} />
    </span>
  );
}

function HomeScreen({
  onStart,
  onSelectCompany,
  history,
  selectedCompanyId,
}: {
  onStart: (mode: SessionMode, companyId?: CompanyId) => void;
  onSelectCompany: (companyId: CompanyId) => void;
  history: CompletedSession[];
  selectedCompanyId: CompanyId;
}) {
  const latest = history[0];
  const latestSummary = latest ? summarizeSession(latest) : null;
  const selectedCompany = getCompanyWorld(selectedCompanyId);

  return (
    <main className="home-shell">
      <section className="home-main">
        <div className="eyebrow-row">
          <span className="status-dot" />
          <span>Phase 2 · Company Worlds</span>
        </div>

        <div className="hero-copy">
          <p className="overline">Today’s training</p>
          <h1>
            Practice the weak spot.
            <span>Keep the reflex.</span>
          </h1>
          <p>
            Short drills for technical judgment and interview delivery—built from
            your real preparation material.
          </p>
        </div>

        <section className="company-worlds" aria-labelledby="company-worlds-title">
          <div className="company-worlds__header">
            <div>
              <p className="overline">Company worlds</p>
              <h2 id="company-worlds-title">Practice for the room you want.</h2>
            </div>
            <span className="company-worlds__count">03 worlds</span>
          </div>

          <div className="company-selector" aria-label="Choose a company world" role="group">
            {companyWorlds.map((company) => (
              <button
                aria-pressed={company.id === selectedCompanyId}
                className={company.id === selectedCompanyId ? "is-selected" : undefined}
                key={company.id}
                onClick={() => onSelectCompany(company.id)}
                type="button"
              >
                <span className="company-selector__mark" aria-hidden="true">
                  {company.name.slice(0, 1)}
                </span>
                <span>
                  <strong>{company.name}</strong>
                  <small>{company.focusAreas.slice(0, 2).join(" · ")}</small>
                </span>
                <span className="company-selector__state" aria-hidden="true">
                  {company.id === selectedCompanyId ? "Selected" : "Choose"}
                </span>
              </button>
            ))}
          </div>

          <div className="company-world-detail" key={selectedCompany.id}>
            <div className="company-world-detail__copy">
              <span className="company-world-detail__eyebrow">Selected world</span>
              <h3>{selectedCompany.name}</h3>
              <p>{selectedCompany.description}</p>
              <ul aria-label={`${selectedCompany.name} focus areas`}>
                {selectedCompany.focusAreas.map((focusArea) => (
                  <li key={focusArea}>{focusArea}</li>
                ))}
              </ul>
            </div>

            <div className="company-world-detail__actions">
              <p><strong>Standard world</strong> · 5 engineering + 2 interview drills</p>
              <button
                className="company-start-button"
                onClick={() => onStart("company", selectedCompany.id)}
                type="button"
              >
                Start {selectedCompany.name} World <Icon name="arrow" />
              </button>
              <button
                className="company-rapid-button"
                onClick={() => onStart("rapid-fire", selectedCompany.id)}
                type="button"
              >
                <span>Rapid Fire</span>
                <small>5 drills · recent misses first</small>
                <Icon name="bolt" />
              </button>
              <a href={selectedCompany.source.url} rel="noreferrer" target="_blank">
                Company source: {selectedCompany.source.title} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>

        <div className="core-training-heading">
          <p className="overline">Core training</p>
          <span>Keep building the fundamentals</span>
        </div>

        <div className="mode-grid" aria-label="Core training modes">
          {modes.map((mode, index) => (
            <button
              className={`mode-card mode-card--${mode.accent}`}
              key={mode.id}
              onClick={() => onStart(mode.id)}
              type="button"
            >
              <div className="mode-card__topline">
                <ModeIcon mode={mode.id} />
                <span className="mode-index">0{index + 1}</span>
              </div>
              <div>
                <span className="mode-kicker">{mode.kicker}</span>
                <h2>{mode.title}</h2>
                <p>{mode.description}</p>
              </div>
              <div className="mode-card__footer">
                <span>{mode.duration}</span>
                <span className="round-arrow"><Icon name="arrow" /></span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="readiness-panel">
        <div className="readiness-panel__header">
          <div>
            <p className="overline">Readiness signal</p>
            <h2>Next focus</h2>
          </div>
          <span className="signal-badge">Live</span>
        </div>

        <div className="focus-score">
          <div className="score-orbit" aria-label="Distributed systems confidence: 35 percent">
            <span>35</span>
            <small>%</small>
          </div>
          <div>
            <h3>Distributed systems</h3>
            <p>Highest-priority depth gap</p>
          </div>
        </div>

        <div className="focus-list">
          <div><span>01</span><p>Queues, retries & idempotency</p></div>
          <div><span>02</span><p>Consistency & failure recovery</p></div>
          <div><span>03</span><p>Live system-design delivery</p></div>
        </div>

        <div className="last-session">
          <span className="last-session__label">Last run</span>
          {latestSummary ? (
            <>
              <strong>{latestSummary.percentage}% accuracy</strong>
              <p>{getSessionLabel(latest.mode, latest.companyId)} · {latest.attempts.length} drills saved</p>
            </>
          ) : (
            <>
              <strong>No attempts yet</strong>
              <p>Your first sprint establishes the baseline.</p>
            </>
          )}
        </div>
      </aside>
    </main>
  );
}

function ResponseControl({
  exercise,
  response,
  onChange,
  submitted,
}: {
  exercise: Exercise;
  response: string[];
  onChange: (response: string[]) => void;
  submitted: boolean;
}) {
  if (exercise.type === "choice" || exercise.type === "multi-select") {
    const multi = exercise.type === "multi-select";
    return (
      <div className="option-list">
        {exercise.options.map((option, index) => {
          const selected = response.includes(option.id);
          const correct =
            exercise.type === "choice"
              ? exercise.correctOptionId === option.id
              : exercise.correctOptionIds.includes(option.id);
          const answerState = submitted
            ? correct
              ? "is-correct-answer"
              : selected
                ? "is-incorrect-answer"
                : ""
            : "";
          return (
            <button
              aria-label={`${index + 1}. ${option.label}${submitted && correct ? ", correct answer" : submitted && selected ? ", selected answer" : ""}`}
              aria-pressed={selected}
              className={`answer-option ${selected ? "is-selected" : ""} ${answerState}`}
              disabled={submitted}
              key={option.id}
              onClick={() => {
                if (!multi) {
                  onChange([option.id]);
                  return;
                }
                onChange(
                  selected
                    ? response.filter((id) => id !== option.id)
                    : [...response, option.id],
                );
              }}
              type="button"
            >
              <span className="option-key">{index + 1}</span>
              <span>{option.label}</span>
              <span className="option-marker" aria-hidden="true">
                {submitted ? (correct ? "✓" : selected ? "×" : "") : multi ? "＋" : ""}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (exercise.type === "ordering") {
    const ordered = response.length === 0 ? exercise.items.map((item) => item.id) : response;
    return (
      <div className="ordering-list" aria-label="Answer order">
        {ordered.map((itemId, index) => {
          const item = exercise.items.find((candidate) => candidate.id === itemId);
          if (!item) return null;
          return (
            <div
              className={`ordering-item ${
                submitted
                  ? exercise.correctOrder[index] === item.id
                    ? "is-correct-position"
                    : "is-incorrect-position"
                  : ""
              }`}
              key={item.id}
            >
              <span className="order-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{item.label}</span>
              <div className="order-actions">
                <button
                  aria-label={`Move ${item.label} up`}
                  disabled={submitted || index === 0}
                  onClick={() => {
                    const next = [...ordered];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    onChange(next);
                  }}
                  title="Move up"
                  type="button"
                >↑</button>
                <button
                  aria-label={`Move ${item.label} down`}
                  disabled={submitted || index === ordered.length - 1}
                  onClick={() => {
                    const next = [...ordered];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    onChange(next);
                  }}
                  title="Move down"
                  type="button"
                >↓</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const selectedAnchors = response
    .map((id) => exercise.anchors.find((anchor) => anchor.id === id))
    .filter(Boolean);
  const remainingAnchors = exercise.anchors.filter((anchor) => !response.includes(anchor.id));

  return (
    <div className="anchor-builder">
      <div
        aria-label="Your answer structure"
        className={`anchor-sequence ${response.length === 0 ? "is-empty" : ""}`}
      >
        {response.length === 0 ? (
          <p>Your answer structure appears here</p>
        ) : (
          selectedAnchors.map((anchor, index) => (
            <button
              aria-label={`Remove ${anchor?.label} from position ${index + 1}`}
              className={
                submitted
                  ? exercise.correctOrder[index] === anchor?.id
                    ? "is-correct-position"
                    : "is-incorrect-position"
                  : undefined
              }
              disabled={submitted}
              key={anchor?.id}
              onClick={() => onChange(response.filter((id) => id !== anchor?.id))}
              type="button"
            >
              <span>{index + 1}</span>{anchor?.label}<b>×</b>
            </button>
          ))
        )}
      </div>
      <p className="anchor-label">Available anchors</p>
      <div className="anchor-bank">
        {remainingAnchors.map((anchor) => (
          <button
            aria-label={`Add ${anchor.label} to your answer structure`}
            disabled={submitted}
            key={anchor.id}
            onClick={() => onChange([...response, anchor.id])}
            type="button"
          >
            <span>＋</span>{anchor.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CorrectOrderDisclosure({
  exercise,
}: {
  exercise: OrderingExercise | AnchorExercise;
}) {
  const [expanded, setExpanded] = useState(false);
  const options = exercise.type === "ordering" ? exercise.items : exercise.anchors;
  const sequence = exercise.correctOrder
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is NonNullable<typeof option> => Boolean(option));
  const answerKind = exercise.type === "ordering" ? "order" : "structure";
  const contentId = `correct-${answerKind}-${exercise.id}`;

  return (
    <section className={`correct-order-disclosure ${expanded ? "is-expanded" : ""}`}>
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>
          <strong>{expanded ? "Hide" : "Show"} correct {answerKind}</strong>
          <small>Reveal it only when you want the answer.</small>
        </span>
        <span aria-hidden="true" className="correct-order-disclosure__icon">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded ? (
        <ol id={contentId}>
          {sequence.map((option) => (
            <li key={option.id}>{option.label}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function AnswerExamplePanel({
  examples,
  fallbackSource,
}: {
  examples: AnswerExample[];
  fallbackSource: Exercise["source"];
}) {
  const [activeId, setActiveId] = useState(examples[0]?.id ?? "");
  const activeExample =
    examples.find((example) => example.id === activeId) ?? examples[0];

  if (!activeExample) return null;

  const source = activeExample.source ?? fallbackSource;

  return (
    <section className="answer-example" aria-labelledby="answer-example-title">
      <div className="answer-example__header">
        <div>
          <span className="answer-example__kicker">From structure to speech</span>
          <h2 id="answer-example-title">Good answer example</h2>
        </div>
        <span className="answer-example__duration">Learn the shape, not the script</span>
      </div>

      {examples.length > 1 ? (
        <div aria-label="Company answer variant" className="answer-example__tabs">
          {examples.map((example) => (
            <button
              aria-pressed={example.id === activeExample.id}
              className={example.id === activeExample.id ? "is-active" : undefined}
              key={example.id}
              onClick={() => setActiveId(example.id)}
              type="button"
            >
              {example.label}
            </button>
          ))}
        </div>
      ) : null}

      <blockquote key={activeExample.id}>{activeExample.answer}</blockquote>
      <a href={source.url} rel="noreferrer" target="_blank">
        Source material: {source.title} <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}

function SessionScreen({
  companyId,
  mode,
  sessionExercises,
  initialStartedAt,
  onExit,
  onFinish,
}: {
  companyId?: CompanyId;
  mode: SessionMode;
  sessionExercises: Exercise[];
  initialStartedAt: number;
  onExit: () => void;
  onFinish: (attempts: Attempt[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const exercise = sessionExercises[index];
  const sessionLabel = getSessionLabel(mode, companyId);
  const currentAttempt = attempts[attempts.length - 1];
  const progress = ((index + (submitted ? 1 : 0)) / sessionExercises.length) * 100;

  const effectiveResponse =
    exercise.type === "ordering" && response.length === 0
      ? exercise.items.map((item) => item.id)
      : response;

  function submit() {
    if (effectiveResponse.length === 0) return;
    const attempt = makeAttempt(exercise, effectiveResponse, Date.now() - startedAt);
    setAttempts((current) => [...current, attempt]);
    setSubmitted(true);
  }

  function next() {
    if (index === sessionExercises.length - 1) {
      onFinish(attempts);
      return;
    }
    setIndex((current) => current + 1);
    setResponse([]);
    setSubmitted(false);
    setStartedAt(Date.now());
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      questionHeadingRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [index]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("button, a, input, select, textarea"))
      ) {
        return;
      }

      if (
        !submitted &&
        (exercise.type === "choice" || exercise.type === "multi-select") &&
        /^[1-9]$/.test(event.key)
      ) {
        const option = exercise.options[Number(event.key) - 1];
        if (!option) return;

        event.preventDefault();
        if (exercise.type === "choice") {
          setResponse([option.id]);
        } else {
          setResponse((current) =>
            current.includes(option.id)
              ? current.filter((id) => id !== option.id)
              : [...current, option.id],
          );
        }
        return;
      }

      if (event.key === "Enter") {
        if (!submitted && effectiveResponse.length === 0) return;
        event.preventDefault();
        if (submitted) next();
        else submit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const shortcutHint =
    exercise.type === "choice" || exercise.type === "multi-select"
      ? `Keys 1–${exercise.options.length} select · Enter checks`
      : exercise.type === "ordering"
        ? "Arrow controls reorder · Enter checks"
        : "Select anchors in speaking order · Enter checks";

  return (
    <main className="session-shell">
      <header className="session-header">
        <button aria-label="Exit session and return home" className="wordmark" onClick={onExit} type="button">
          <span>IJ</span> Interdojo
        </button>
        <div className="session-meta">
          <span title={sessionLabel}>{sessionLabel}</span>
          <strong>{index + 1} / {sessionExercises.length}</strong>
        </div>
        <button aria-label="Exit session and return home" className="exit-button" onClick={onExit} type="button">Exit</button>
      </header>

      <div className="progress-track" aria-label="Session progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} aria-valuetext={`Drill ${index + 1} of ${sessionExercises.length}`} role="progressbar">
        <span style={{ width: `${progress}%` }} />
      </div>

      <section className="exercise-stage">
        <div className="exercise-card">
          <div className="exercise-heading">
            <div>
              <span className={`track-pill track-pill--${exercise.track}`}>{exercise.track}</span>
              <span className="exercise-eyebrow">{exercise.eyebrow}</span>
            </div>
            <span className="interaction-label">{exercise.type.replaceAll("-", " ")}</span>
          </div>

          <div className="question-copy">
            <h1 ref={questionHeadingRef} tabIndex={-1}>{exercise.prompt}</h1>
            <p>{exercise.instruction}</p>
          </div>

          <ResponseControl
            exercise={exercise}
            onChange={setResponse}
            response={response}
            submitted={submitted}
          />

          {submitted && currentAttempt ? (
            <div
              aria-live="polite"
              className={`feedback-panel ${currentAttempt.correct ? "is-correct" : "is-review"}`}
              role="status"
            >
              <div className="feedback-icon"><Icon name={currentAttempt.correct ? "check" : "arrow"} /></div>
              <div>
                <strong>{currentAttempt.correct ? "Correct — that model holds." : "Not quite — review this one."}</strong>
                <p>{exercise.explanation}</p>
                <a href={exercise.source.url} rel="noreferrer" target="_blank">Read source: {exercise.source.title} <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          ) : null}

          {submitted &&
          currentAttempt &&
          !currentAttempt.correct &&
          (exercise.type === "ordering" || exercise.type === "anchor-reconstruction") ? (
            <CorrectOrderDisclosure exercise={exercise} key={`correct-${exercise.id}`} />
          ) : null}

          {submitted && exercise.answerExamples ? (
            <AnswerExamplePanel
              examples={exercise.answerExamples}
              fallbackSource={exercise.source}
              key={`example-${exercise.id}`}
            />
          ) : null}

          <div className="exercise-actions">
            <span className="shortcut-hint">{shortcutHint}</span>
            {submitted ? (
              <button className="primary-button" onClick={next} type="button">
                {index === sessionExercises.length - 1 ? "See results" : "Next drill"}
                <Icon name="arrow" />
              </button>
            ) : (
              <button className="primary-button" disabled={effectiveResponse.length === 0} onClick={submit} type="button">
                Check answer <Icon name="arrow" />
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultsScreen({
  session,
  onHome,
  onRetry,
}: {
  session: CompletedSession;
  onHome: () => void;
  onRetry: () => void;
}) {
  const summary = summarizeSession(session);
  const strong = summary.strongSkillIds.map(getSkillName).filter(Boolean);
  const review = summary.reviewSkillIds.map(getSkillName).filter(Boolean);
  const sessionLabel = getSessionLabel(session.mode, session.companyId);
  const isCompanySession = session.mode === "company" || session.mode === "rapid-fire";

  return (
    <main className="results-shell">
      <div className="results-card">
        <p className="overline">{sessionLabel} · Complete</p>
        <div className="results-hero">
          <div aria-label={`${summary.percentage} percent accuracy`} className="result-score">
            <span>{summary.percentage}</span><small>%</small>
          </div>
          <div>
            <h1>{summary.percentage >= 80 ? "Sharp work." : "Useful signal."}</h1>
            <p>{summary.score} of {summary.total} mental models held under pressure.</p>
          </div>
        </div>

        <div className="result-columns">
          <section aria-labelledby="strong-today-heading">
            <span className="result-label result-label--strong" id="strong-today-heading">Strong today</span>
            {strong.length ? strong.map((name) => <p key={name}><Icon name="check" />{name}</p>) : <p>Build the baseline with another run.</p>}
          </section>
          <section aria-labelledby="review-next-heading">
            <span className="result-label result-label--review" id="review-next-heading">Review next</span>
            {review.length ? review.map((name) => <p key={name}><Icon name="arrow" />{name}</p>) : <p>No review areas in this sprint.</p>}
          </section>
        </div>

        <div className="results-note">
          <strong>What happens now</strong>
          <p>
            {isCompanySession
              ? `Your ${sessionLabel} attempts were saved. Rapid Fire can bring recent misses back into the next five-drill run.`
              : "Your attempts were saved. Phase 1 reports the signal; adaptive scheduling arrives in Phase 3."}
          </p>
        </div>

        <div className="results-actions">
          <button className="secondary-button" onClick={onHome} type="button">Back home</button>
          <button className="primary-button" onClick={onRetry} type="button">Run it again <Icon name="arrow" /></button>
        </div>
      </div>
    </main>
  );
}

export function ArcadeApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<SessionMode>("daily");
  const [selectedCompanyId, setSelectedCompanyId] = useState<CompanyId>("ashby");
  const [activeCompanyId, setActiveCompanyId] = useState<CompanyId | undefined>();
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState("");
  const [completedSession, setCompletedSession] = useState<CompletedSession | null>(null);
  const [history, setHistory] = useState<CompletedSession[]>([]);

  useEffect(() => {
    const storedCompanyId = localStorage.getItem(LAST_COMPANY_KEY);
    if (companyWorlds.some((company) => company.id === storedCompanyId)) {
      queueMicrotask(() => setSelectedCompanyId(storedCompanyId as CompanyId));
    }

    const localHistory = loadLocalHistory();
    queueMicrotask(() => setHistory(localHistory));

    void fetch("/api/sessions")
      .then((response) => response.json())
      .then((payload: { sessions?: CompletedSession[] }) => {
        if (!Array.isArray(payload.sessions) || payload.sessions.length === 0) return;
        const merged = [...payload.sessions, ...localHistory].filter(
          (session, index, collection) =>
            collection.findIndex((candidate) => candidate.id === session.id) === index,
        );
        merged.sort(
          (left, right) =>
            Date.parse(right.completedAt) - Date.parse(left.completedAt),
        );
        const recent = merged.slice(0, 30);
        setHistory(recent);
        localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(recent));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const exerciseLookup = useMemo(
    () => new Map(allExercises.map((exercise) => [exercise.id, exercise])),
    [],
  );

  function selectCompany(companyId: CompanyId) {
    setSelectedCompanyId(companyId);
    localStorage.setItem(LAST_COMPANY_KEY, companyId);
  }

  function start(nextMode: SessionMode, nextCompanyId?: CompanyId) {
    const isCompanyMode = nextMode === "company" || nextMode === "rapid-fire";
    const companyId = isCompanyMode
      ? nextCompanyId ?? selectedCompanyId
      : undefined;
    const exercises = isCompanyMode && companyId
      ? buildSessionExercises(
          { mode: nextMode, companyId },
          nextMode === "rapid-fire" ? { history } : {},
        )
      : buildSessionExercises(nextMode);

    setMode(nextMode);
    setActiveCompanyId(companyId);
    setSessionExercises(exercises);
    setSessionStartedAt(new Date().toISOString());
    setCompletedSession(null);
    setScreen("session");
  }

  function finish(attempts: Attempt[]) {
    const session: CompletedSession = {
      id: crypto.randomUUID(),
      mode,
      ...(activeCompanyId ? { companyId: activeCompanyId } : {}),
      startedAt: sessionStartedAt,
      completedAt: new Date().toISOString(),
      attempts: attempts.filter((attempt) => exerciseLookup.has(attempt.exerciseId)),
    };
    setCompletedSession(session);
    setHistory((current) => [session, ...current]);
    void persistSession(session);
    setScreen("results");
  }

  if (screen === "session") {
    return (
      <SessionScreen
        companyId={activeCompanyId}
        initialStartedAt={Date.parse(sessionStartedAt)}
        mode={mode}
        onExit={() => setScreen("home")}
        onFinish={finish}
        sessionExercises={sessionExercises}
      />
    );
  }

  if (screen === "results" && completedSession) {
    return (
      <ResultsScreen
        onHome={() => setScreen("home")}
        onRetry={() => start(completedSession.mode, completedSession.companyId)}
        session={completedSession}
      />
    );
  }

  return (
    <HomeScreen
      history={history}
      onSelectCompany={selectCompany}
      onStart={start}
      selectedCompanyId={selectedCompanyId}
    />
  );
}
