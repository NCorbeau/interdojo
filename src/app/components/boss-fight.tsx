"use client";

import { useEffect, useRef } from "react";
import {
  chooseBossFight,
  getBossFightDebrief,
  getBossFightView,
} from "@/lib/boss-fight/engine";
import type { BossFightScenario, BossFightState, BossFightTopic } from "@/lib/boss-fight/types";
import { orderBossFightChoices } from "./boss-fight-choice-order";
import styles from "./BossFight.module.css";

export type BossFightProps = {
  scenario: BossFightScenario;
  state: BossFightState;
  runId: string;
  saveStatus?: "d1" | "local" | "saving";
  notice?: string;
  onStateChange: (next: BossFightState) => void;
  onReplay: () => void;
  onExit: () => void;
};

const topicLabels: Record<BossFightTopic, string> = {
  retries: "Retries",
  idempotency: "Idempotency",
  consistency: "Consistency",
  recovery: "Recovery",
};

function remainingStageCount(scenario: BossFightScenario, stageId: string): number {
  const stage = scenario.stages.find((item) => item.id === stageId);
  if (!stage) return 0;
  return 1 + Math.max(...stage.choices.map((choice) =>
    choice.nextStageId === null ? 0 : remainingStageCount(scenario, choice.nextStageId)),
  );
}

export function BossFight({ scenario, state, runId, saveStatus, notice, onStateChange, onReplay, onExit }: BossFightProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const view = getBossFightView(scenario, state);
  const debrief = view ? null : getBossFightDebrief(scenario, state);
  const previousDecision = state.decisions.at(-1);
  const previousStage = previousDecision
    ? scenario.stages.find((stage) => stage.id === previousDecision.stageId)
    : undefined;
  const previousChoice = previousStage?.choices.find((choice) => choice.id === previousDecision?.choiceId);
  const totalStages = view
    ? state.decisions.length + remainingStageCount(scenario, view.stageId)
    : state.decisions.length;
  const orderedChoices = view ? orderBossFightChoices(view.choices, runId, view.stageId) : [];

  useEffect(() => {
    headingRef.current?.focus();
  }, [view?.stageId]);

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <header className={styles.topbar}>
          <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true">IJ</span> Interdojo</div>
          <button className={styles.exit} type="button" onClick={onExit}>
            Back to practice
          </button>
        </header>

        <div className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>Boss Fight · Decision practice</p>
            <h1>{scenario.title}</h1>
            <p className={styles.introCopy}>
              Make a call at each turn. The situation changes with your decisions; review the consequences at the end.
            </p>
          </div>
          <div className={styles.meta}>
            <span>{scenario.estimatedMinutes} min · {debrief ? "Debrief" : `Decision ${view?.stageNumber}`}</span>
            {(saveStatus || notice) && (
              <div className={styles.saveStatus} role="status" aria-live="polite" aria-atomic="true">
                {saveStatus && (
                  <span className={styles.saveState}>
                    {saveStatus === "d1" ? "Saved to cloud" : saveStatus === "local" ? "Saved on this device" : "Saving…"}
                  </span>
                )}
                {notice && <span className={styles.notice}>{notice}</span>}
              </div>
            )}
          </div>
        </div>

        <div className={styles.progress} role="progressbar" aria-label="Boss Fight progress"
          aria-valuemin={0} aria-valuemax={totalStages} aria-valuenow={state.decisions.length}
          aria-valuetext={debrief ? "Encounter complete" : `${state.decisions.length} decisions made; decision ${view?.stageNumber} is next`}>
          {Array.from({ length: totalStages }, (_, index) => (
            <span key={index} aria-hidden="true" className={[
              styles.progressStep,
              index < state.decisions.length ? styles.progressStepDone : "",
              view && index === state.decisions.length ? styles.progressStepCurrent : "",
            ].filter(Boolean).join(" ")} />
          ))}
        </div>

        {view ? (
          <div className={styles.layout}>
            <section className={styles.primary} aria-labelledby="boss-stage-title">
              <div className={styles.stageCard}>
                <div className={styles.stageTop}>
                  <div className={styles.stageLabel}>
                    <span className={styles.stageNumber} aria-hidden="true">{String(view.stageNumber).padStart(2, "0")}</span>
                    <span className={styles.stageLabelText}>Decision {view.stageNumber}</span>
                  </div>
                  <h2 id="boss-stage-title" ref={headingRef} tabIndex={-1}>{view.title}</h2>
                  <p className={styles.prompt}>{view.prompt}</p>
                  {view.context.length > 0 && (
                    <div className={styles.context}>
                      <p className={styles.contextLabel}>The situation now</p>
                      {view.context.map((context, index) => <p key={`${index}-${context}`}>{context}</p>)}
                    </div>
                  )}
                  {previousChoice && (
                    <div className={`${styles.consequence} ${styles.consequenceInline}`} aria-live="polite">
                      <p className={styles.eyebrow}>Previous decision · Consequence</p>
                      <h3>{previousStage?.title}</h3>
                      <p>{previousChoice.feedback}</p>
                    </div>
                  )}
                </div>
                <div className={styles.decisionArea}>
                  <h3>What do you do?</h3>
                  <div className={styles.choices} role="group" aria-label={`Choices for decision ${view.stageNumber}`}>
                    {orderedChoices.map((choice, index) => (
                      <button className={styles.choice} key={choice.id} type="button"
                        onClick={() => onStateChange(chooseBossFight(scenario, state, choice.id))}>
                        <span className={styles.choiceIndex} aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                        <span className={styles.choiceText}>{choice.label}</span>
                        <span className={styles.choiceArrow} aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className={styles.sidebar} aria-label="Encounter context">
              <div className={styles.brief}>
                <p className={styles.eyebrow}>Field notes</p>
                <h3>Stay with the trade-off.</h3>
                <p>Choose the response you would actually take. Each choice has a consequence, and the next decision may carry it forward.</p>
              </div>
              {previousChoice && (
                <div className={`${styles.consequence} ${styles.consequenceSidebar}`} aria-live="polite">
                  <p className={styles.eyebrow}>Previous decision · Consequence</p>
                  <h3>{previousStage?.title}</h3>
                  <p>{previousChoice.feedback}</p>
                </div>
              )}
              <div className={styles.source}>
                <p>Scenario source</p>
                <a href={scenario.source.url} target="_blank" rel="noopener noreferrer">
                  {scenario.source.title} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </aside>
          </div>
        ) : debrief && (
          <div className={styles.debriefLayout}>
            <section className={styles.debriefCard} aria-labelledby="boss-debrief-title">
              <p className={styles.eyebrow}>Encounter complete</p>
              <h2 id="boss-debrief-title" ref={headingRef} tabIndex={-1}>Your decision trail</h2>
              <p className={styles.debriefLead}>Review what followed from each call and the concepts this incident brings into focus.</p>
              <div className={styles.debriefSection}>
                <h3>What happened</h3>
                <ol className={styles.decisionList}>
                  {debrief.decisions.map((decision, index) => {
                    const stage = scenario.stages.find((item) => item.id === decision.stageId);
                    const alternative = stage?.choices.find((choice) => choice.id !== decision.choiceId);
                    return (
                      <li className={styles.decisionItem} key={`${decision.stageId}-${decision.choiceId}`}>
                        <span className={styles.itemLabel}>Decision {index + 1} · Your call</span>
                        <strong>{decision.choiceLabel}</strong>
                        <p>{decision.feedback}</p>
                        {alternative && (
                          <div className={styles.alternative}>
                            <span className={styles.itemLabel}>Alternative to consider</span>
                            <strong>{alternative.label}</strong>
                            <p>{alternative.feedback}</p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className={styles.debriefSection}>
                <h3>Takeaways</h3>
                <ul className={styles.learningList}>
                  {debrief.points.map((point) => (
                    <li className={styles.learningItem} key={point.id}>
                      <span className={styles.itemLabel}>{topicLabels[point.topic]}</span>
                      <p>{point.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <aside className={styles.sidebar} aria-label="After the encounter">
              <div className={styles.brief}>
                <p className={styles.eyebrow}>Practice again</p>
                <h3>Try another path.</h3>
                <p>Replay the scenario to see how a different choice changes the situation.</p>
              </div>
              <button className={styles.replay} type="button" onClick={onReplay}>Replay Boss Fight ↗</button>
              <div className={styles.source}>
                <p>Scenario source</p>
                <a href={debrief.source.url} target="_blank" rel="noopener noreferrer">
                  {debrief.source.title} <span aria-hidden="true">↗</span>
                </a>
              </div>
              <p className={styles.note}>This is a practice debrief about decisions and consequences.</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
