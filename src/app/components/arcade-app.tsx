"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { companyWorlds, getCompanyWorld } from "@/lib/company-worlds";
import { allExercises, allSkills } from "@/lib/exercise-bank";
import { deriveLearningState, type SkillLearningState } from "@/lib/learning-state";
import type {
  AnswerExample,
  AnchorExercise,
  Attempt,
  CompanyId,
  CompletedSession,
  Exercise,
  OrderingExercise,
  PhaseOneSessionMode,
  SelfAssessment,
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
  const recentSessions = history.slice(0, 3).map((session) => ({
    session,
    summary: summarizeSession(session),
  }));
  const selectedCompany = getCompanyWorld(selectedCompanyId);
  const learning = deriveLearningState(history, allSkills);
  const baselineFocus = ["distributed-systems", "system-design", "node-runtime"];
  const rankedPractice = allSkills
    .map((skill) => ({ skill, state: learning.get(skill.id) }))
    .filter((item): item is { skill: (typeof allSkills)[number]; state: SkillLearningState } =>
      item.state !== undefined,
    )
    .sort((left, right) =>
      right.state.priority - left.state.priority ||
      (baselineFocus.indexOf(left.skill.id) < 0 ? 99 : baselineFocus.indexOf(left.skill.id)) -
        (baselineFocus.indexOf(right.skill.id) < 0 ? 99 : baselineFocus.indexOf(right.skill.id)) ||
      left.skill.id.localeCompare(right.skill.id),
    );
  const topEngineering = rankedPractice.find((item) => item.skill.track === "engineering");
  const topInterview = rankedPractice.find((item) => item.skill.track === "interview");
  const balancedPractice = [topEngineering, topInterview].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const third = rankedPractice.find((item) => !balancedPractice.includes(item));
  if (third) balancedPractice.push(third);
  balancedPractice.sort((left, right) => right.state.priority - left.state.priority);
  const practiceNext = history.length > 0
    ? balancedPractice.map(({ skill, state }) => ({
        name: skill.name,
        reason: state.reason,
      }))
    : [
        { name: "Distributed systems", reason: "A useful place to begin" },
        { name: "System design", reason: "Build a clear answer structure" },
        { name: "Node.js runtime", reason: "Warm up the backend reflex" },
      ];

  return (
    <main className="home-shell">
      <header className="home-header">
        <div className="home-brand"><span aria-hidden="true">IJ</span><strong>Interdojo</strong></div>
        <span className="home-header__context">Your practice space</span>
        <span className="home-header__count">{history.length} {history.length === 1 ? "run" : "runs"} saved</span>
      </header>

      <section className="home-main">
        <div className="hero-copy">
          <p className="overline"><span className="status-dot" /> Today’s training</p>
          <h1>
            Practice the weak spot.
            <span>Keep the reflex.</span>
          </h1>
          <p>
            Short, focused drills for technical judgment and interview delivery.
          </p>
        </div>

        <section className="today-card" aria-labelledby="today-card-title">
          <div className="today-card__body">
            <span className="today-card__icon"><Icon name="bolt" /></span>
            <div>
              <p className="overline">Your next session</p>
              <h2 id="today-card-title">Daily Sprint</h2>
              <p>{history.length > 0
                ? "An adaptive mix shaped by your recent practice."
                : "A quick mix of engineering and interview drills."}</p>
            </div>
          </div>
          <div className="today-card__action">
            <span><strong>07</strong> drills <i aria-hidden="true">/</i> about 8 min</span>
            <button onClick={() => onStart("daily")} type="button">
              Start sprint <Icon name="arrow" />
            </button>
          </div>
        </section>

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
            <p className="overline">{history.length > 0 ? "From your practice" : "Suggested starting point"}</p>
            <h2>Practice next</h2>
          </div>
          {history.length > 0 ? <span className="signal-badge">Adaptive</span> : null}
        </div>

        <div className="focus-score">
          <div className="practice-orbit" aria-hidden="true">01</div>
          <div>
            <h3>{practiceNext[0].name}</h3>
            <p>{practiceNext[0].reason}</p>
          </div>
        </div>

        <div className="focus-list">
          {practiceNext.slice(1).map((item, index) => (
            <div key={item.name}>
              <span>0{index + 2}</span>
              <p><strong>{item.name}</strong><small>{item.reason}</small></p>
            </div>
          ))}
        </div>

        <div className="recent-runs">
          <div className="recent-runs__header">
            <span className="overline">Recent runs</span>
            {history.length > 0 ? <span>Last {recentSessions.length}</span> : null}
          </div>
          {recentSessions.length > 0 ? (
            <ol>
              {recentSessions.map(({ session, summary }) => (
                <li key={session.id}>
                  <div className="recent-runs__row">
                    <strong>{getSessionLabel(session.mode, session.companyId)}</strong>
                    <span>{summary.gradedTotal > 0
                      ? `${summary.score}/${summary.gradedTotal} graded`
                      : `${summary.selfCheckCount} self-checks`}</span>
                  </div>
                  {summary.gradedTotal > 0 ? (
                    <div className="recent-runs__track" aria-label={`${summary.score} of ${summary.gradedTotal} graded answers correct`} role="img">
                      <span style={{ width: `${summary.percentage}%` }} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="recent-runs__empty">Your first sprint will start your practice history.</p>
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
  modelRevealed,
  onRevealModel,
  onRateSelfCheck,
}: {
  exercise: Exercise;
  response: string[];
  onChange: (response: string[]) => void;
  submitted: boolean;
  modelRevealed: boolean;
  onRevealModel: () => void;
  onRateSelfCheck: (assessment: SelfAssessment) => void;
}) {
  const modelPointsRef = useRef<HTMLDivElement>(null);
  const savedStatusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (exercise.type === "self-check" && submitted) {
      savedStatusRef.current?.focus({ preventScroll: true });
    } else if (exercise.type === "self-check" && modelRevealed) {
      modelPointsRef.current?.focus({ preventScroll: true });
    }
  }, [exercise.id, exercise.type, modelRevealed, submitted]);

  if (exercise.type === "self-check") {
    return (
      <section className="self-check" aria-labelledby={`self-check-title-${exercise.id}`}>
        <div className="self-check__prompt">
          <span aria-hidden="true" className="self-check__step">01</span>
          <div>
            <h2 id={`self-check-title-${exercise.id}`}>Say it first</h2>
            <p>Pause and explain the idea in your own words, aloud or silently. Keep the model points hidden until you are ready.</p>
          </div>
        </div>
        {modelRevealed ? (
          <div aria-live="polite" className="self-check__model" ref={modelPointsRef} tabIndex={-1}>
            <p className="self-check__model-label">Model points</p>
            <ul>{exercise.modelPoints.map((point) => <li key={point}>{point}</li>)}</ul>
          </div>
        ) : (
          <button className="self-check__reveal" onClick={onRevealModel} type="button">
            Reveal model points <span aria-hidden="true">↓</span>
          </button>
        )}
        {modelRevealed && !submitted ? (
          <div className="self-check__ratings" aria-label="Rate your explanation">
            <p>How did it go?</p>
            <div>
              <button className="self-check__rating self-check__rating--got-it" onClick={() => onRateSelfCheck("got-it")} type="button">
                Got it
              </button>
              <button className="self-check__rating self-check__rating--needs-work" onClick={() => onRateSelfCheck("needs-work")} type="button">
                Needs work
              </button>
            </div>
          </div>
        ) : null}
        {submitted ? (
          <p className="self-check__saved" ref={savedStatusRef} role="status" tabIndex={-1}>Self-rating saved. This is your reflection, not an objective score.</p>
        ) : null}
      </section>
    );
  }

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
  const [modelRevealed, setModelRevealed] = useState(false);
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

  const isSelfCheck = exercise.type === "self-check";

  function submit() {
    if (isSelfCheck) {
      setModelRevealed(true);
      return;
    }
    if (effectiveResponse.length === 0) return;
    const attempt = makeAttempt(exercise, effectiveResponse, Date.now() - startedAt);
    setAttempts((current) => [...current, attempt]);
    setSubmitted(true);
  }

  function rateSelfCheck(assessment: SelfAssessment) {
    if (!isSelfCheck || !modelRevealed || submitted) return;
    const attempt = makeAttempt(exercise, [assessment], Date.now() - startedAt, assessment);
    setAttempts((current) => [...current, attempt]);
    setResponse([assessment]);
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
    setModelRevealed(false);
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
        if (isSelfCheck) return;
        if (!submitted && effectiveResponse.length === 0) return;
        event.preventDefault();
        if (submitted) next();
        else submit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const shortcutHint = isSelfCheck
    ? "Think it through · Reveal when ready · Rate yourself"
    : exercise.type === "choice" || exercise.type === "multi-select"
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

      <div className="session-progress" aria-label="Session progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} aria-valuetext={`${index + (submitted ? 1 : 0)} of ${sessionExercises.length} drills complete`} role="progressbar">
        {sessionExercises.map((item, step) => (
          <span
            aria-hidden="true"
            className={`session-progress__step ${step < index || (step === index && submitted) ? "is-complete" : step === index ? "is-current" : ""}`}
            key={item.id}
          />
        ))}
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
          {exercise.selectionReason ? <p className="selection-reason">Practice next: {exercise.selectionReason}</p> : null}

          <div className="question-copy">
            <h1 ref={questionHeadingRef} tabIndex={-1}>{exercise.prompt}</h1>
            <p>{exercise.instruction}</p>
          </div>

          <ResponseControl
            exercise={exercise}
            onChange={setResponse}
            response={response}
            submitted={submitted}
            modelRevealed={modelRevealed}
            onRevealModel={submit}
            onRateSelfCheck={rateSelfCheck}
          />

          {submitted && currentAttempt ? (
            <div
              aria-live="polite"
              className={`feedback-panel ${currentAttempt.correct === true ? "is-correct" : currentAttempt.correct === false ? "is-review" : "is-self-check"}`}
              role="status"
            >
              <div className="feedback-icon"><Icon name={currentAttempt.correct === true || currentAttempt.selfAssessment === "got-it" ? "check" : "arrow"} /></div>
              <div>
                <strong>{currentAttempt.correct === null
                  ? currentAttempt.selfAssessment === "got-it" ? "You felt ready to explain it." : "You marked this for more practice."
                  : currentAttempt.correct ? "Correct — that model holds." : "Not quite — review this one."}</strong>
                <p>{exercise.explanation}</p>
                <a href={exercise.source.url} rel="noreferrer" target="_blank">Read source: {exercise.source.title} <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          ) : null}

          {submitted && currentAttempt?.correct !== null &&
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
            ) : isSelfCheck ? (
              null
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
          <div aria-label={summary.gradedTotal
            ? `${summary.percentage} percent accuracy across ${summary.gradedTotal} graded drills`
            : `No objectively graded drills; ${summary.selfCheckCount} self-checks rated`} className="result-score">
            <span>{summary.gradedTotal ? summary.percentage : "—"}</span>{summary.gradedTotal ? <small>%</small> : null}
          </div>
          <div>
            <h1>{summary.gradedTotal === 0 ? "Reflection recorded." : summary.percentage >= 80 ? "Sharp work." : "Useful signal."}</h1>
            <p>{summary.gradedTotal
              ? `${summary.score} of ${summary.gradedTotal} objectively graded drills correct${summary.selfCheckCount ? ` · ${summary.selfCheckCount} self-check${summary.selfCheckCount === 1 ? "" : "s"} rated` : ""}.`
              : `${summary.selfCheckCount} self-check${summary.selfCheckCount === 1 ? "" : "s"} rated. This is self-reported, not an objective score.`}</p>
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
              ? `Your ${sessionLabel} attempts were saved. The next world session can respond to what needs practice; Rapid Fire still brings back recent graded misses.`
              : "Your attempts were saved. The next Daily Sprint will use this evidence to choose a useful mix."}
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
          { history },
        )
      : buildSessionExercises(nextMode, { history });

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
