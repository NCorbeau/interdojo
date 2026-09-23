import { chooseBossFight, getBossFightView, validateBossFightState } from "./engine";
import type { BossFightScenario, BossFightState } from "./types";

export type BossFightRun = {
  id: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  state: BossFightState;
};

function validTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function validateBossFightRun(value: unknown, scenario: BossFightScenario): string[] {
  if (!value || typeof value !== "object") return ["Run must be an object"];
  const run = value as Partial<BossFightRun>;
  const errors: string[] = [];
  if (typeof run.id !== "string" || run.id.trim().length < 1 || run.id.length > 128) errors.push("Run ID is invalid");
  if (!validTime(run.startedAt) || !validTime(run.updatedAt)) errors.push("Run timestamps are invalid");
  else if (run.updatedAt < run.startedAt) errors.push("Run update precedes start");
  if (run.completedAt !== null && !validTime(run.completedAt)) errors.push("Run completion time is invalid");
  if (validTime(run.completedAt) && validTime(run.startedAt) && validTime(run.updatedAt)) {
    if (run.completedAt < run.startedAt || run.completedAt > run.updatedAt) errors.push("Run completion time is out of order");
  }
  errors.push(...validateBossFightState(scenario, run.state));
  if (!errors.length) {
    const complete = getBossFightView(scenario, run.state!) === null;
    if (complete !== (run.completedAt !== null)) errors.push("Completion time must match graph completion");
  }
  return errors;
}

export function createBossFightRun(
  scenario: BossFightScenario,
  id = globalThis.crypto.randomUUID(),
  now = new Date().toISOString(),
): BossFightRun {
  const run: BossFightRun = {
    id,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    state: { scenarioId: scenario.id, scenarioVersion: scenario.version, decisions: [] },
  };
  const errors = validateBossFightRun(run, scenario);
  if (errors.length) throw new Error(`Invalid Boss Fight run: ${errors.join("; ")}`);
  return run;
}

export function advanceBossFightRun(
  scenario: BossFightScenario,
  run: BossFightRun,
  choiceId: string,
  now = new Date().toISOString(),
): BossFightRun {
  const errors = validateBossFightRun(run, scenario);
  if (errors.length) throw new Error(`Invalid Boss Fight run: ${errors.join("; ")}`);
  if (!validTime(now)) throw new Error("Invalid Boss Fight update time");
  const state = chooseBossFight(scenario, run.state, choiceId);
  const updatedAt = now < run.updatedAt ? run.updatedAt : now;
  const complete = getBossFightView(scenario, state) === null;
  return { ...run, state, updatedAt, completedAt: complete ? updatedAt : null };
}

/** The decision log is append-only. Identical saves are idempotent. */
export function compareBossFightRuns(current: BossFightRun, incoming: BossFightRun): "same" | "advance" | "stale" | "diverged" {
  if (current.id !== incoming.id || current.startedAt !== incoming.startedAt ||
      current.state.scenarioId !== incoming.state.scenarioId ||
      current.state.scenarioVersion !== incoming.state.scenarioVersion) return "diverged";
  const currentLog = current.state.decisions;
  const incomingLog = incoming.state.decisions;
  const shared = Math.min(currentLog.length, incomingLog.length);
  for (let index = 0; index < shared; index += 1) {
    if (currentLog[index].stageId !== incomingLog[index].stageId ||
        currentLog[index].choiceId !== incomingLog[index].choiceId) return "diverged";
  }
  if (currentLog.length === incomingLog.length) return "same";
  if (currentLog.length > incomingLog.length) return "stale";
  return current.completedAt === null ? "advance" : "diverged";
}
