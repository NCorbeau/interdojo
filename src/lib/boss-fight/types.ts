export type BossFightTopic = "retries" | "idempotency" | "consistency" | "recovery";

export type BossFightCondition = {
  stageId: string;
  choiceId: string;
};

export type BossFightChoice = {
  id: string;
  label: string;
  /** Shown in the debrief as a consequence of this decision, not a score. */
  feedback: string;
  /** A null target completes the encounter. */
  nextStageId: string | null;
};

export type BossFightStage = {
  id: string;
  title: string;
  prompt: string;
  /** Extra situation text displayed when the earlier decision was made. */
  context?: { when: BossFightCondition; text: string }[];
  choices: BossFightChoice[];
};

export type BossFightDebriefPoint = {
  id: string;
  topic: BossFightTopic;
  text: string;
  when?: BossFightCondition;
};

export type BossFightScenario = {
  id: string;
  version: number;
  title: string;
  estimatedMinutes: number;
  source: { title: string; url: string };
  startStageId: string;
  stages: BossFightStage[];
  debrief: BossFightDebriefPoint[];
};

/** JSON-safe state. The decisions are the complete source of progress. */
export type BossFightState = {
  scenarioId: string;
  scenarioVersion: number;
  decisions: { stageId: string; choiceId: string }[];
};

export type BossFightStageView = {
  stageId: string;
  title: string;
  prompt: string;
  context: string[];
  choices: Pick<BossFightChoice, "id" | "label">[];
  stageNumber: number;
};

export type BossFightDebrief = {
  scenarioId: string;
  source: BossFightScenario["source"];
  points: BossFightDebriefPoint[];
  decisions: {
    stageId: string;
    choiceId: string;
    choiceLabel: string;
    feedback: string;
  }[];
};
