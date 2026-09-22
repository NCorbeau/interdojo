import { companyExerciseModules } from "./company-exercises";
import { ashbyFocusExercises } from "./shared-exercises/ashby-focus";
import { attioFocusExercises } from "./shared-exercises/attio-focus";
import { linearFocusExercises } from "./shared-exercises/linear-focus";
import type {
  CompanyId,
  Exercise,
  ExerciseTag,
  Skill,
} from "./domain";
import {
  exercises as phaseOneExerciseDefinitions,
  skills as phaseOneSkills,
} from "./exercises";

const baseTagsBySkillId: Record<string, ExerciseTag[]> = {
  "distributed-systems": ["distributed-systems", "transactions"],
  "node-runtime": ["node-runtime", "performance"],
  "system-design": ["system-design", "product-judgment"],
  "career-narrative": ["career-narrative", "staff-judgment"],
  "company-motivation": ["company-motivation", "product-judgment"],
  "claim-boundaries": ["claim-boundaries", "staff-judgment"],
  behavioral: ["behavioral", "staff-judgment"],
};

const additionalTagsByExerciseId: Record<string, ExerciseTag[]> = {
  "ds-ack-window": ["api-data"],
  "ds-retry-design": ["product-judgment"],
  "ds-exactly-once": ["api-data"],
  "ds-transactional-outbox": ["api-data"],
  "ds-stale-event": ["realtime", "state-architecture"],
  "ds-overload-controls": ["performance"],
  "node-production-debug": ["product-judgment"],
  "node-cancellation": ["api-data", "product-judgment"],
  "node-bounded-concurrency": ["api-data"],
  "system-design-conversation": ["staff-judgment"],
  "system-design-cache-policy": ["api-data", "state-architecture"],
  "system-design-realtime-recovery": ["realtime", "state-architecture"],
  "narrative-strengths": ["ai-assisted-engineering"],
  "narrative-ai-boundaries": ["ai-assisted-engineering"],
  "behavioral-grid-story": ["state-architecture", "interaction-quality"],
};

const skillById = new Map(phaseOneSkills.map((skill) => [skill.id, skill]));

function withPhaseOneTags(exercise: Exercise): Exercise {
  return {
    ...exercise,
    tags: [
      ...new Set([
        ...(exercise.tags ?? []),
        ...(baseTagsBySkillId[exercise.skillId] ?? []),
        ...(additionalTagsByExerciseId[exercise.id] ?? []),
      ]),
    ],
  };
}

export const phaseOneExercises = phaseOneExerciseDefinitions.map(withPhaseOneTags);

function assertValidExercise(exercise: Exercise): void {
  if (!exercise.id || !exercise.skillId || !exercise.tags || exercise.tags.length === 0) {
    throw new Error(`Exercise ${exercise.id || "<missing id>"} is incomplete`);
  }

  const skill = skillById.get(exercise.skillId);
  if (!skill || skill.track !== exercise.track) {
    throw new Error(
      `Exercise ${exercise.id} references an invalid ${exercise.track} skill: ${exercise.skillId}`,
    );
  }

  if (!exercise.source.title || !exercise.source.url.startsWith("https://app.notion.com/")) {
    throw new Error(`Exercise ${exercise.id} needs a canonical Notion source`);
  }

  const answerIds =
    exercise.type === "choice" || exercise.type === "multi-select"
      ? new Set(exercise.options.map((option) => option.id))
      : exercise.type === "ordering"
        ? new Set(exercise.items.map((item) => item.id))
        : new Set(exercise.anchors.map((anchor) => anchor.id));
  const correctIds =
    exercise.type === "choice"
      ? [exercise.correctOptionId]
      : exercise.type === "multi-select"
        ? exercise.correctOptionIds
        : exercise.correctOrder;

  if (correctIds.length === 0 || correctIds.some((id) => !answerIds.has(id))) {
    throw new Error(`Exercise ${exercise.id} has an invalid answer key`);
  }
}

function aggregateExercises(): Exercise[] {
  const combined = [
    ...phaseOneExercises,
    ...ashbyFocusExercises,
    ...attioFocusExercises,
    ...linearFocusExercises,
    ...companyExerciseModules.flatMap((module) => module.exercises),
  ];
  const seen = new Set<string>();

  for (const exercise of combined) {
    if (seen.has(exercise.id)) {
      throw new Error(`Duplicate exercise id: ${exercise.id}`);
    }
    seen.add(exercise.id);
    assertValidExercise(exercise);
  }

  return combined;
}

export const allExercises = aggregateExercises();

export const allSkills: Skill[] = [
  ...phaseOneSkills,
];

export function getExercise(exerciseId: string): Exercise | undefined {
  return allExercises.find((exercise) => exercise.id === exerciseId);
}

export function getCompanyEligibleExercises(companyId: CompanyId): Exercise[] {
  return allExercises.filter(
    (exercise) => exercise.companyId === undefined || exercise.companyId === companyId,
  );
}
