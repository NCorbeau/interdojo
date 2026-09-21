"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exercises, getSkill } from "@/lib/exercises";
import type {
  Attempt,
  CompletedSession,
  Exercise,
  SessionMode,
} from "@/lib/domain";
import {
  buildSessionExercises,
  makeAttempt,
  summarizeSession,
} from "@/lib/session";

const LOCAL_HISTORY_KEY = "interdojo:sessions:v1";
const LEGACY_LOCAL_HISTORY_KEY = "interview-arcade:sessions:v1";

type Screen = "home" | "session" | "results";

const modes: Array<{
  id: SessionMode;
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
      return JSON.parse(currentHistory) as CompletedSession[];
    }

    const legacyHistory = localStorage.getItem(LEGACY_LOCAL_HISTORY_KEY);
    if (!legacyHistory) return [];

    localStorage.setItem(LOCAL_HISTORY_KEY, legacyHistory);
    return JSON.parse(legacyHistory) as CompletedSession[];
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

function ModeIcon({ mode }: { mode: SessionMode }) {
  return (
    <span className="mode-icon">
      <Icon name={mode === "daily" ? "bolt" : mode === "engineering" ? "code" : "voice"} />
    </span>
  );
}

function HomeScreen({
  onStart,
  history,
}: {
  onStart: (mode: SessionMode) => void;
  history: CompletedSession[];
}) {
  const latest = history[0];
  const latestSummary = latest ? summarizeSession(latest) : null;

  return (
    <main className="home-shell">
      <section className="home-main">
        <div className="eyebrow-row">
          <span className="status-dot" />
          <span>Phase 1 · Playable Core</span>
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

        <div className="mode-grid" aria-label="Training modes">
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
              <p>{latest?.attempts.length} drills saved on this device</p>
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

function SessionScreen({
  mode,
  sessionExercises,
  initialStartedAt,
  onExit,
  onFinish,
}: {
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
          <span>{modes.find((candidate) => candidate.id === mode)?.title}</span>
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
  const strong = summary.strongSkillIds.map((id) => getSkill(id)?.name).filter(Boolean);
  const review = summary.reviewSkillIds.map((id) => getSkill(id)?.name).filter(Boolean);

  return (
    <main className="results-shell">
      <div className="results-card">
        <p className="overline">Sprint complete</p>
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
          <p>Your attempts were saved. Phase 1 reports the signal; adaptive scheduling arrives in Phase 3.</p>
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
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState("");
  const [completedSession, setCompletedSession] = useState<CompletedSession | null>(null);
  const [history, setHistory] = useState<CompletedSession[]>([]);

  useEffect(() => {
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
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [],
  );

  function start(nextMode: SessionMode) {
    setMode(nextMode);
    setSessionExercises(buildSessionExercises(nextMode));
    setSessionStartedAt(new Date().toISOString());
    setCompletedSession(null);
    setScreen("session");
  }

  function finish(attempts: Attempt[]) {
    const session: CompletedSession = {
      id: crypto.randomUUID(),
      mode,
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
        onRetry={() => start(mode)}
        session={completedSession}
      />
    );
  }

  return <HomeScreen history={history} onStart={start} />;
}
