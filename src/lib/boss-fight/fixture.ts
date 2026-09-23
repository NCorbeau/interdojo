import type { BossFightScenario } from "./types";

/** Synthetic graph for engine verification; user-facing copy lives in scenario.ts. */
export const bossFightFixture: BossFightScenario = {
  id: "fixture-three-step",
  version: 1,
  title: "Synthetic three-step fixture",
  estimatedMinutes: 9,
  source: { title: "Synthetic test fixture", url: "https://example.com/fixture" },
  startStageId: "design",
  stages: [
    {
      id: "design",
      title: "Design",
      prompt: "Choose a design.",
      choices: [
        { id: "safe", label: "Guard the operation", feedback: "The guard survives a retry.", nextStageId: "execute" },
        { id: "fragile", label: "Skip the guard", feedback: "A retry can repeat the effect.", nextStageId: "execute" },
      ],
    },
    {
      id: "execute",
      title: "Execute",
      prompt: "Choose the next action.",
      choices: [
        { id: "bounded", label: "Use a bounded retry", feedback: "The retry budget is finite.", nextStageId: "recover" },
        { id: "unbounded", label: "Retry forever", feedback: "Unbounded retries can compound a failure.", nextStageId: "recover" },
      ],
    },
    {
      id: "recover",
      title: "Recover",
      prompt: "Choose a recovery action.",
      context: [
        { when: { stageId: "design", choiceId: "safe" }, text: "The stable operation identity limits duplicate effects." },
        { when: { stageId: "design", choiceId: "fragile" }, text: "The repeated operation produced a second effect that must be reconciled." },
      ],
      choices: [
        { id: "inspect", label: "Inspect then repair", feedback: "Recovery follows a known state.", nextStageId: null },
        { id: "replay", label: "Replay blindly", feedback: "Blind replay may compound the inconsistency.", nextStageId: null },
      ],
    },
  ],
  debrief: [
    { id: "retry", topic: "retries", text: "Bound retries and classify failures." },
    { id: "idempotency", topic: "idempotency", text: "Stable identity makes repeat handling safe." },
    { id: "consistency", topic: "consistency", text: "Protect the authoritative invariant." },
    { id: "recovery", topic: "recovery", text: "Inspect durable state before repair." },
    { id: "fragile-impact", topic: "recovery", text: "A duplicate effect now needs reconciliation.", when: { stageId: "design", choiceId: "fragile" } },
  ],
};
