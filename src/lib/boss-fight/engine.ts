import type {
  BossFightChoice,
  BossFightCondition,
  BossFightDebrief,
  BossFightScenario,
  BossFightStageView,
  BossFightState,
  BossFightTopic,
} from "./types";

const topics: BossFightTopic[] = ["retries", "idempotency", "consistency", "recovery"];

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function matches(decisions: BossFightState["decisions"], when: BossFightCondition): boolean {
  return decisions.some((decision) => decision.stageId === when.stageId && decision.choiceId === when.choiceId);
}

/** Checks authored data, including every route through the graph. Returns all discovered errors. */
export function validateBossFightScenario(scenario: BossFightScenario): string[] {
  const errors: string[] = [];
  if (!filled(scenario.id)) errors.push("Scenario ID is required");
  if (!Number.isInteger(scenario.version) || scenario.version < 1) errors.push("Scenario version must be a positive integer");
  if (!filled(scenario.title)) errors.push("Scenario title is required");
  if (!Number.isInteger(scenario.estimatedMinutes) || scenario.estimatedMinutes < 1) {
    errors.push("Estimated minutes must be a positive integer");
  }
  if (!filled(scenario.source?.title)) errors.push("Source title is required");
  try {
    const url = new URL(scenario.source?.url);
    if (!(["http:", "https:"].includes(url.protocol) && url.hostname)) errors.push("Source URL must be an HTTP(S) URL");
  } catch {
    errors.push("Source URL must be an HTTP(S) URL");
  }

  const stageById = new Map(scenario.stages.map((stage) => [stage.id, stage]));
  if (stageById.size !== scenario.stages.length) errors.push("Stage IDs must be unique");
  if (!stageById.has(scenario.startStageId)) errors.push("Start stage does not exist");
  for (const stage of scenario.stages) {
    if (!filled(stage.id) || !filled(stage.title) || !filled(stage.prompt)) errors.push(`Stage ${stage.id || "(missing ID)"} needs an ID, title, and prompt`);
    if (!stage.choices.length) errors.push(`Stage ${stage.id} has no choices`);
    if (new Set(stage.choices.map((choice) => choice.id)).size !== stage.choices.length) errors.push(`Stage ${stage.id} has duplicate choice IDs`);
    for (const choice of stage.choices) {
      if (!filled(choice.id) || !filled(choice.label) || !filled(choice.feedback)) errors.push(`Stage ${stage.id} has an incomplete choice`);
      if (choice.nextStageId !== null && !stageById.has(choice.nextStageId)) errors.push(`Choice ${stage.id}/${choice.id} targets a missing stage`);
    }
    for (const item of stage.context ?? []) {
      if (!filled(item.text)) errors.push(`Stage ${stage.id} has empty conditional context`);
    }
  }
  if (new Set(scenario.debrief.map((point) => point.id)).size !== scenario.debrief.length) errors.push("Debrief point IDs must be unique");
  for (const point of scenario.debrief) {
    if (!filled(point.id) || !filled(point.text) || !topics.includes(point.topic)) errors.push(`Debrief point ${point.id || "(missing ID)"} is incomplete`);
  }

  const checkCondition = (when: BossFightCondition, label: string) => {
    const stage = stageById.get(when.stageId);
    if (!stage?.choices.some((choice) => choice.id === when.choiceId)) errors.push(`${label} refers to an unknown decision`);
  };
  for (const stage of scenario.stages) {
    for (const item of stage.context ?? []) checkCondition(item.when, `Context on ${stage.id}`);
  }
  for (const point of scenario.debrief) if (point.when) checkCondition(point.when, `Debrief ${point.id}`);

  if (!stageById.has(scenario.startStageId)) return errors;
  const reached = new Set<string>();
  const completePaths: BossFightState["decisions"][] = [];
  const visits: { stageId: string; decisions: BossFightState["decisions"]; ancestry: Set<string> }[] = [
    { stageId: scenario.startStageId, decisions: [], ancestry: new Set() },
  ];
  while (visits.length) {
    const visit = visits.pop()!;
    if (visit.ancestry.has(visit.stageId)) {
      errors.push(`Cycle reaches stage ${visit.stageId}`);
      continue;
    }
    const stage = stageById.get(visit.stageId);
    if (!stage) continue;
    reached.add(stage.id);
    const ancestry = new Set(visit.ancestry).add(stage.id);
    for (const choice of stage.choices) {
      const decisions = [...visit.decisions, { stageId: stage.id, choiceId: choice.id }];
      if (choice.nextStageId === null) {
        completePaths.push(decisions);
        if (decisions.length < 3 || decisions.length > 4) errors.push(`Route ending at ${stage.id}/${choice.id} has ${decisions.length} stages; expected 3–4`);
      } else if (stageById.has(choice.nextStageId)) {
        visits.push({ stageId: choice.nextStageId, decisions, ancestry });
      }
    }
  }
  for (const stage of scenario.stages) if (!reached.has(stage.id)) errors.push(`Stage ${stage.id} is unreachable`);
  if (!completePaths.length) errors.push("No route reaches an ending");
  for (const stage of scenario.stages) {
    for (const item of stage.context ?? []) {
      if (!completePaths.some((path) => {
        const stageIndex = path.findIndex((decision) => decision.stageId === stage.id);
        return stageIndex >= 0 && matches(path.slice(0, stageIndex), item.when);
      })) {
        errors.push(`Context on ${stage.id} cannot be reached after ${item.when.stageId}/${item.when.choiceId}`);
      }
    }
  }
  for (const point of scenario.debrief) {
    if (point.when && !completePaths.some((path) => matches(path, point.when!))) {
      errors.push(`Debrief ${point.id} condition is unreachable`);
    }
  }
  for (const path of completePaths) {
    const visible = scenario.debrief.filter((point) => !point.when || matches(path, point.when));
    for (const topic of topics) {
      if (!visible.some((point) => point.topic === topic)) errors.push(`Route ending at ${path.at(-1)?.stageId}/${path.at(-1)?.choiceId} lacks ${topic} debrief`);
    }
  }
  return [...new Set(errors)];
}

/** Validates JSON loaded from storage against the authored graph. Any valid prefix may resume. */
export function validateBossFightState(scenario: BossFightScenario, state: unknown): string[] {
  const errors: string[] = [];
  if (typeof state !== "object" || state === null) return ["State must be an object"];
  const candidate = state as Partial<BossFightState>;
  if (candidate.scenarioId !== scenario.id || candidate.scenarioVersion !== scenario.version) errors.push("State belongs to another scenario or version");
  if (!Array.isArray(candidate.decisions)) return [...errors, "State decisions must be an array"];
  const stageById = new Map(scenario.stages.map((stage) => [stage.id, stage]));
  let stageId: string | null = scenario.startStageId;
  for (const [index, decision] of candidate.decisions.entries()) {
    if (!decision || typeof decision !== "object" || !filled(decision.stageId) || !filled(decision.choiceId)) {
      errors.push(`Decision ${index + 1} is malformed`);
      break;
    }
    if (stageId === null) {
      errors.push(`Decision ${index + 1} occurs after completion`);
      break;
    }
    if (decision.stageId !== stageId) {
      errors.push(`Decision ${index + 1} skips or changes stage ${stageId}`);
      break;
    }
    const choice: BossFightChoice | undefined = stageById.get(stageId)?.choices.find((item) => item.id === decision.choiceId);
    if (!choice) {
      errors.push(`Decision ${index + 1} names an unknown choice`);
      break;
    }
    stageId = choice.nextStageId;
  }
  return errors;
}

function nextStageId(scenario: BossFightScenario, state: BossFightState): string | null {
  const errors = validateBossFightState(scenario, state);
  if (errors.length) throw new Error(`Invalid Boss Fight state: ${errors.join("; ")}`);
  if (!state.decisions.length) return scenario.startStageId;
  const last = state.decisions.at(-1)!;
  return scenario.stages.find((stage) => stage.id === last.stageId)!
    .choices.find((choice) => choice.id === last.choiceId)!.nextStageId;
}

export function startBossFight(scenario: BossFightScenario): BossFightState {
  const errors = validateBossFightScenario(scenario);
  if (errors.length) throw new Error(`Invalid Boss Fight scenario: ${errors.join("; ")}`);
  return { scenarioId: scenario.id, scenarioVersion: scenario.version, decisions: [] };
}

export function getBossFightView(scenario: BossFightScenario, state: BossFightState): BossFightStageView | null {
  const stageId = nextStageId(scenario, state);
  if (stageId === null) return null;
  const stage = scenario.stages.find((item) => item.id === stageId);
  if (!stage) throw new Error(`Missing Boss Fight stage ${stageId}`);
  return {
    stageId: stage.id,
    title: stage.title,
    prompt: stage.prompt,
    context: (stage.context ?? []).filter((item) => matches(state.decisions, item.when)).map((item) => item.text),
    choices: stage.choices.map(({ id, label }) => ({ id, label })),
    stageNumber: state.decisions.length + 1,
  };
}

export function chooseBossFight(scenario: BossFightScenario, state: BossFightState, choiceId: string): BossFightState {
  const stageId = nextStageId(scenario, state);
  if (stageId === null) throw new Error("Boss Fight is already complete");
  const stage = scenario.stages.find((item) => item.id === stageId)!;
  if (!stage.choices.some((choice) => choice.id === choiceId)) throw new Error(`Choice ${choiceId} is not available at stage ${stageId}`);
  return {
    scenarioId: state.scenarioId,
    scenarioVersion: state.scenarioVersion,
    decisions: [...state.decisions, { stageId, choiceId }],
  };
}

export function getBossFightDebrief(scenario: BossFightScenario, state: BossFightState): BossFightDebrief {
  if (nextStageId(scenario, state) !== null) throw new Error("Boss Fight is not complete");
  return {
    scenarioId: scenario.id,
    source: scenario.source,
    points: scenario.debrief.filter((point) => !point.when || matches(state.decisions, point.when)),
    decisions: state.decisions.map((decision) => {
      const choice = scenario.stages.find((stage) => stage.id === decision.stageId)!
        .choices.find((item) => item.id === decision.choiceId)!;
      return { ...decision, choiceLabel: choice.label, feedback: choice.feedback };
    }),
  };
}
