import { bossFightFixture } from "./fixture";
import {
  chooseBossFight,
  getBossFightDebrief,
  getBossFightView,
  startBossFight,
  validateBossFightScenario,
  validateBossFightState,
} from "./engine";
import type { BossFightScenario, BossFightState } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rejects(action: () => unknown, message: string) {
  let rejected = false;
  try { action(); } catch { rejected = true; }
  assert(rejected, message);
}

assert(validateBossFightScenario(bossFightFixture).length === 0, "Fixture graph is invalid");
const start = startBossFight(bossFightFixture);
assert(getBossFightView(bossFightFixture, start)?.stageId === "design", "Start stage is wrong");
rejects(() => chooseBossFight(bossFightFixture, start, "missing"), "Unknown choice was accepted");
rejects(() => getBossFightDebrief(bossFightFixture, start), "Incomplete debrief was accepted");

const fragile = chooseBossFight(bossFightFixture, start, "fragile");
assert(start.decisions.length === 0, "Transition mutated previous state");
const fragileRetry = chooseBossFight(bossFightFixture, fragile, "unbounded");
const fragileView = getBossFightView(bossFightFixture, fragileRetry);
assert(fragileView?.context.length === 1 && fragileView.context[0].includes("second effect"), "Earlier decision did not change the failure context");
const restored = JSON.parse(JSON.stringify(fragileRetry)) as BossFightState;
assert(validateBossFightState(bossFightFixture, restored).length === 0, "Serialized decision prefix did not resume");
const fragileDone = chooseBossFight(bossFightFixture, restored, "inspect");
assert(getBossFightView(bossFightFixture, fragileDone) === null, "Completed encounter still has a stage");
const fragileDebrief = getBossFightDebrief(bossFightFixture, fragileDone);
assert(fragileDebrief.points.some((point) => point.id === "fragile-impact"), "Path-specific debrief was lost");
assert(new Set(fragileDebrief.points.map((point) => point.topic)).size === 4, "Debrief is missing a teaching topic");
rejects(() => chooseBossFight(bossFightFixture, fragileDone, "inspect"), "Completed run accepted another choice");

const safeDone = chooseBossFight(bossFightFixture,
  chooseBossFight(bossFightFixture, chooseBossFight(bossFightFixture, start, "safe"), "bounded"),
  "inspect");
assert(!getBossFightDebrief(bossFightFixture, safeDone).points.some((point) => point.id === "fragile-impact"), "Other path received wrong debrief");
assert(getBossFightView(bossFightFixture, chooseBossFight(bossFightFixture,
  chooseBossFight(bossFightFixture, start, "safe"), "bounded"))?.context[0]?.includes("limits duplicate"), "Safe route context was lost");

assert(validateBossFightState(bossFightFixture, { ...start, decisions: [{ stageId: "recover", choiceId: "inspect" }] }).length > 0, "Stage skip was accepted");
assert(validateBossFightState(bossFightFixture, { ...fragileDone, decisions: [...fragileDone.decisions, { stageId: "recover", choiceId: "replay" }] }).length > 0, "Post-completion decision was accepted");
assert(validateBossFightState(bossFightFixture, { ...start, scenarioVersion: 99 }).length > 0, "Foreign version was accepted");

const changed = (edit: (scenario: BossFightScenario) => void): BossFightScenario => {
  const scenario = structuredClone(bossFightFixture);
  edit(scenario);
  return scenario;
};
assert(validateBossFightScenario(changed((scenario) => { scenario.source.url = "invalid"; })).some((error) => error.includes("Source URL")), "Invalid source was accepted");
assert(validateBossFightScenario(changed((scenario) => { scenario.stages[1].id = "design"; })).some((error) => error.includes("unique")), "Duplicate stage ID was accepted");
assert(validateBossFightScenario(changed((scenario) => { scenario.stages[2].choices[0].nextStageId = "design"; })).some((error) => error.includes("Cycle")), "Cycle was accepted");
assert(validateBossFightScenario(changed((scenario) => { scenario.stages[0].choices[0].nextStageId = "missing"; })).some((error) => error.includes("missing stage")), "Dead end was accepted");
assert(validateBossFightScenario(changed((scenario) => { scenario.stages[2].context![0].when.choiceId = "missing"; })).some((error) => error.includes("unknown decision")), "Bad condition was accepted");
assert(validateBossFightScenario(changed((scenario) => { scenario.stages.push({ id: "orphan", title: "Orphan", prompt: "?", choices: [{ id: "end", label: "End", feedback: "Done", nextStageId: null }] }); })).some((error) => error.includes("unreachable")), "Unreachable stage was accepted");

console.log("Boss Fight foundation verified: branching context, replay, debrief, and graph/state validation.");
