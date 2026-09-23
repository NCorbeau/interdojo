import assert from "node:assert/strict";
import {
  chooseBossFight,
  getBossFightDebrief,
  getBossFightView,
  startBossFight,
  validateBossFightScenario,
  validateBossFightState,
} from "../src/lib/boss-fight/engine";
import { ruleCopyBossFight } from "../src/lib/boss-fight/scenario";
import type { BossFightState } from "../src/lib/boss-fight/types";

assert.deepEqual(validateBossFightScenario(ruleCopyBossFight), [], "Authored graph must be valid");
assert.equal(ruleCopyBossFight.estimatedMinutes, 10);
assert.match(ruleCopyBossFight.stages[0].prompt, /Hypothetical extension/);

const routes: BossFightState[] = [];
const visitedChoices = new Set<string>();
const topics = new Set(["retries", "idempotency", "consistency", "recovery"]);

function decision(state: BossFightState, stageId: string): string | undefined {
  return state.decisions.find((item) => item.stageId === stageId)?.choiceId;
}

function checkContext(state: BossFightState): void {
  const view = getBossFightView(ruleCopyBossFight, state);
  if (!view) return;
  const source = decision(state, "ownership");
  const scale = decision(state, "scale");
  const context = view.context.join(" ");

  if (view.stageId === "scale") {
    assert.equal(view.context.length, 1, "Scale stage should reflect exactly one ownership choice");
    assert.match(context, source === "pinned-input" ? /fixed source input/ : /process staying alive/);
  }
  if (view.stageId === "retry-sync" || view.stageId === "retry-async") {
    assert.equal(view.stageId, scale === "sync-cap" ? "retry-sync" : "retry-async");
    assert.equal(view.context.length, 1, "Retry stage should reflect exactly one ownership choice");
    assert.match(context, source === "pinned-input" ? /same source snapshot|fixed input/ : /different source graph|different rule content/);
  }
  if (view.stageId === "recover-sync") {
    assert.equal(scale, "sync-cap");
    assert.match(context, decision(state, "retry-sync") === "inspect-outcome" ? /paused a second apply/ : /duplicate target rules/);
    assert.equal(view.context.length, source === "live-chunks" ? 2 : 1);
    if (source === "live-chunks") assert.match(context, /Without a fixed source snapshot/);
  }
  if (view.stageId === "recover-async") {
    assert.equal(scale, "async-job");
    assert.match(context, decision(state, "retry-async") === "same-job" ? /same job identity/ : /fresh job/);
    assert.equal(view.context.length, source === "live-chunks" ? 2 : 1);
    if (source === "live-chunks") assert.match(context, /changed source/);
  }
}

function walk(state: BossFightState): void {
  assert.deepEqual(validateBossFightState(ruleCopyBossFight, state), []);
  const restored = JSON.parse(JSON.stringify(state)) as BossFightState;
  assert.deepEqual(validateBossFightState(ruleCopyBossFight, restored), [], "Serialized prefix should resume");
  assert.deepEqual(getBossFightView(ruleCopyBossFight, restored), getBossFightView(ruleCopyBossFight, state));
  checkContext(state);

  const view = getBossFightView(ruleCopyBossFight, state);
  if (!view) {
    assert.equal(state.decisions.length, 4, "Every run must have four decisions");
    assert.deepEqual(
      state.decisions.map((item) => item.stageId),
      ["ownership", "scale", decision(state, "scale") === "sync-cap" ? "retry-sync" : "retry-async", decision(state, "scale") === "sync-cap" ? "recover-sync" : "recover-async"],
    );
    const debrief = getBossFightDebrief(ruleCopyBossFight, restored);
    assert.deepEqual(new Set(debrief.points.map((point) => point.topic)), topics);
    assert.equal(debrief.decisions.length, 4);
    const ids = new Set(debrief.points.map((point) => point.id));
    assert.equal(ids.has("pinned-held"), decision(state, "ownership") === "pinned-input");
    assert.equal(ids.has("live-broke"), decision(state, "ownership") === "live-chunks");
    assert.equal(ids.has("sync-tradeoff"), decision(state, "scale") === "sync-cap");
    assert.equal(ids.has("async-tradeoff"), decision(state, "scale") === "async-job");
    assert.equal(ids.has("blind-retry-cost"), decision(state, "retry-sync") === "blind-retry");
    assert.equal(ids.has("new-job-cost"), decision(state, "retry-async") === "new-job");
    routes.push(state);
    return;
  }

  for (const choice of view.choices) {
    visitedChoices.add(`${view.stageId}/${choice.id}`);
    const next = chooseBossFight(ruleCopyBossFight, restored, choice.id);
    assert.equal(restored.decisions.length + 1, next.decisions.length);
    walk(next);
  }
}

walk(startBossFight(ruleCopyBossFight));
assert.equal(routes.length, 16, "All source, scale, retry, and recovery choices should combine");
assert.equal(visitedChoices.size, ruleCopyBossFight.stages.reduce((total, stage) => total + stage.choices.length, 0));

const completed = routes[0];
assert.notDeepEqual(validateBossFightState(ruleCopyBossFight, {
  ...completed,
  decisions: [...completed.decisions, { stageId: "ownership", choiceId: "pinned-input" }],
}), [], "A completed run must reject extra decisions");
assert.notDeepEqual(validateBossFightState(ruleCopyBossFight, {
  ...completed,
  decisions: [{ stageId: "scale", choiceId: "sync-cap" }],
}), [], "Replay must reject a skipped opening stage");
assert.notDeepEqual(validateBossFightState(ruleCopyBossFight, {
  ...completed,
  scenarioVersion: completed.scenarioVersion + 1,
}), [], "Resume must reject another scenario version");

console.log(`Boss Fight scenario verified: ${routes.length} complete paths, four decisions each, conditional consequences, four debrief topics, and serialized resume.`);
