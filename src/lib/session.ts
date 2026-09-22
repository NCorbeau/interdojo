import { getCompanyWorld } from "./company-worlds";
import {
  getCompanyEligibleExercises,
  phaseOneExercises,
} from "./exercise-bank";
import type {
  Attempt,
  CompanyId,
  CompanySessionMode,
  CompanyWorldSessionConfig,
  CompletedSession,
  Exercise,
  PhaseOneSessionMode,
  SessionMode,
  SessionRequest,
  SessionSummary,
  Track,
} from "./domain";

export type RandomSource = () => number;

export type BuildSessionOptions = {
  rng?: RandomSource;
  companyId?: CompanyId;
  history?: readonly CompletedSession[];
  sessionConfig?: CompanyWorldSessionConfig;
};

function randomIndex(length: number, rng: RandomSource): number {
  if (length <= 0) return 0;
  const value = rng();
  const normalized = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1 - Number.EPSILON)
    : 0;
  return Math.floor(normalized * length);
}

function shuffled<T>(items: readonly T[], rng: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1, rng);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function shuffledMultiSelectOptions(
  exercise: Extract<Exercise, { type: "multi-select" }>,
  rng: RandomSource,
) {
  const options = shuffled(exercise.options, rng);
  const correctIds = new Set(exercise.correctOptionIds);
  const firstDistractorIndex = options.findIndex(
    (option) => !correctIds.has(option.id),
  );
  const hasCorrectAnswerAfterDistractor = options
    .slice(firstDistractorIndex + 1)
    .some((option) => correctIds.has(option.id));

  // A random shuffle can recreate the source-bank pattern by chance. Break that
  // specific shortcut so learners cannot select a contiguous prefix of answers.
  if (firstDistractorIndex > 0 && !hasCorrectAnswerAfterDistractor) {
    const swapIndex = Math.floor(firstDistractorIndex / 2);
    [options[swapIndex], options[firstDistractorIndex]] = [
      options[firstDistractorIndex],
      options[swapIndex],
    ];
  }

  return options;
}

function randomizePresentation(
  exercise: Exercise,
  rng: RandomSource,
): Exercise {
  if (exercise.type === "choice") {
    return { ...exercise, options: shuffled(exercise.options, rng) };
  }

  if (exercise.type === "multi-select") {
    return { ...exercise, options: shuffledMultiSelectOptions(exercise, rng) };
  }

  if (exercise.type === "ordering") {
    return { ...exercise, items: shuffled(exercise.items, rng) };
  }

  return { ...exercise, anchors: shuffled(exercise.anchors, rng) };
}

function buildPhaseOneSession(
  mode: PhaseOneSessionMode,
  rng: RandomSource,
): Exercise[] {
  if (mode === "daily") {
    const engineering = shuffled(
      phaseOneExercises.filter((exercise) => exercise.track === "engineering"),
      rng,
    ).slice(0, 4);
    const interview = shuffled(
      phaseOneExercises.filter((exercise) => exercise.track === "interview"),
      rng,
    ).slice(0, 3);
    return shuffled([...engineering, ...interview], rng).map((exercise) =>
      randomizePresentation(exercise, rng),
    );
  }

  return shuffled(
    phaseOneExercises.filter((exercise) => exercise.track === mode),
    rng,
  )
    .slice(0, 7)
    .map((exercise) => randomizePresentation(exercise, rng));
}

function exerciseWeight(
  exercise: Exercise,
  companyId: CompanyId,
  tagWeights: ReturnType<typeof getCompanyWorld>["tagWeights"],
): number {
  const tagWeight = (exercise.tags ?? []).reduce(
    (total, tag) => total + (tagWeights[tag] ?? 0),
    0,
  );
  const companySpecificWeight = exercise.companyId === companyId ? 4 : 0;
  return Math.max(1, 1 + tagWeight + companySpecificWeight);
}

function weightedPick(
  exercises: readonly Exercise[],
  getWeight: (exercise: Exercise) => number,
  rng: RandomSource,
): Exercise {
  const weighted = exercises.map((exercise) => ({
    exercise,
    weight: Math.max(0, getWeight(exercise)),
  }));
  const totalWeight = weighted.reduce((total, item) => total + item.weight, 0);

  if (totalWeight <= 0) {
    return exercises[randomIndex(exercises.length, rng)];
  }

  let cursor = Math.min(Math.max(rng(), 0), 1 - Number.EPSILON) * totalWeight;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor < 0) return item.exercise;
  }

  return weighted[weighted.length - 1].exercise;
}

function weightedSample(
  exercises: readonly Exercise[],
  count: number,
  getWeight: (exercise: Exercise) => number,
  rng: RandomSource,
): Exercise[] {
  const remaining = [...exercises];
  const selected: Exercise[] = [];

  while (selected.length < count && remaining.length > 0) {
    const exercise = weightedPick(remaining, getWeight, rng);
    selected.push(exercise);
    remaining.splice(
      remaining.findIndex((candidate) => candidate.id === exercise.id),
      1,
    );
  }

  return selected;
}

function scopeExerciseToCompany(
  exercise: Exercise,
  companyId: CompanyId,
): Exercise {
  if (!exercise.answerExamples) return exercise;

  const answerExamples = exercise.answerExamples.filter(
    (example) => example.companyId === undefined || example.companyId === companyId,
  );
  return {
    ...exercise,
    answerExamples: answerExamples.length > 0 ? answerExamples : undefined,
  };
}

function validatesSessionConfig(config: CompanyWorldSessionConfig): boolean {
  return (
    Number.isInteger(config.size) &&
    config.size > 0 &&
    Object.values(config.trackCounts).every(
      (count) => Number.isInteger(count) && count >= 0,
    ) &&
    config.trackCounts.engineering + config.trackCounts.interview === config.size &&
    config.trackCounts.interview >= 1
  );
}

function recentMissIds(history: readonly CompletedSession[]): string[] {
  const misses = history
    .flatMap((session) => session.attempts)
    .filter((attempt) => !attempt.correct)
    .sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt),
    );
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const attempt of misses) {
    if (!seen.has(attempt.exerciseId)) {
      seen.add(attempt.exerciseId);
      ids.push(attempt.exerciseId);
    }
  }

  return ids;
}

function isCompanyMotivationExercise(
  exercise: Exercise,
  companyId: CompanyId,
): boolean {
  return (
    exercise.track === "interview" &&
    Boolean(exercise.tags?.includes("company-motivation")) &&
    (exercise.companyId === companyId ||
      Boolean(
        exercise.answerExamples?.some(
          (example) => example.companyId === companyId,
        ),
      ))
  );
}

export function buildCompanyWorldSession(
  companyId: CompanyId,
  mode: CompanySessionMode = "company",
  options: BuildSessionOptions = {},
): Exercise[] {
  const rng = options.rng ?? Math.random;
  const world = getCompanyWorld(companyId);
  const config =
    options.sessionConfig ??
    (mode === "rapid-fire" ? world.rapidFire : world.standard);
  if (!validatesSessionConfig(config)) {
    throw new Error(`Invalid ${world.name} session configuration`);
  }

  const eligible = getCompanyEligibleExercises(companyId);
  const weight = (exercise: Exercise) =>
    exerciseWeight(exercise, companyId, world.tagWeights);
  const motivationCandidates = eligible.filter(
    (exercise) => isCompanyMotivationExercise(exercise, companyId),
  );
  if (motivationCandidates.length === 0) {
    throw new Error(`${world.name} has no eligible company-motivation exercise`);
  }

  const selected: Exercise[] = [];
  const selectedIds = new Set<string>();
  const slots: Record<Track, number> = {
    engineering: config.trackCounts.engineering,
    interview: config.trackCounts.interview,
  };

  if (mode === "rapid-fire") {
    const eligibleById = new Map(
      eligible.map((exercise) => [exercise.id, exercise]),
    );
    let includedMisses = 0;
    for (const exerciseId of recentMissIds(options.history ?? [])) {
      const exercise = eligibleById.get(exerciseId);
      if (
        includedMisses >= 2 ||
        !exercise ||
        selectedIds.has(exercise.id) ||
        slots[exercise.track] <= 0 ||
        (exercise.track === "interview" &&
          slots.interview === 1 &&
          !isCompanyMotivationExercise(exercise, companyId))
      ) {
        continue;
      }
      selected.push(exercise);
      selectedIds.add(exercise.id);
      slots[exercise.track] -= 1;
      includedMisses += 1;
    }
  }

  if (
    !selected.some((exercise) =>
      isCompanyMotivationExercise(exercise, companyId),
    )
  ) {
    const motivation = weightedPick(
      motivationCandidates.filter((exercise) => !selectedIds.has(exercise.id)),
      weight,
      rng,
    );
    selected.push(motivation);
    selectedIds.add(motivation.id);
    slots.interview -= 1;
  }

  for (const track of ["engineering", "interview"] as const) {
    const candidates = eligible.filter(
      (exercise) =>
        exercise.track === track && !selectedIds.has(exercise.id),
    );
    const additions = weightedSample(candidates, slots[track], weight, rng);
    if (additions.length !== slots[track]) {
      throw new Error(
        `${world.name} needs ${slots[track]} more ${track} exercises but only ${additions.length} are eligible`,
      );
    }
    for (const exercise of additions) {
      selected.push(exercise);
      selectedIds.add(exercise.id);
    }
  }

  if (selected.length !== config.size || selectedIds.size !== config.size) {
    throw new Error(`${world.name} session selection did not produce unique exercises`);
  }

  return shuffled(selected, rng)
    .map((exercise) => scopeExerciseToCompany(exercise, companyId))
    .map((exercise) => randomizePresentation(exercise, rng));
}

export function buildSessionExercises(
  request: SessionMode | SessionRequest,
  options: BuildSessionOptions = {},
): Exercise[] {
  const mode = typeof request === "string" ? request : request.mode;
  const companyId =
    typeof request === "string"
      ? options.companyId
      : "companyId" in request
        ? request.companyId
        : undefined;
  const rng = options.rng ?? Math.random;

  if (mode === "daily" || mode === "engineering" || mode === "interview") {
    return buildPhaseOneSession(mode, rng);
  }

  if (!companyId) {
    throw new Error(`Session mode ${mode} requires a companyId`);
  }

  return buildCompanyWorldSession(companyId, mode, options);
}

export function evaluateResponse(exercise: Exercise, response: string[]): boolean {
  if (exercise.type === "choice") {
    return response.length === 1 && response[0] === exercise.correctOptionId;
  }

  if (exercise.type === "multi-select") {
    return (
      response.length === exercise.correctOptionIds.length &&
      response.every((id) => exercise.correctOptionIds.includes(id))
    );
  }

  return (
    response.length === exercise.correctOrder.length &&
    response.every((id, index) => id === exercise.correctOrder[index])
  );
}

export function summarizeSession(session: CompletedSession): SessionSummary {
  const skillScores = new Map<string, { correct: number; total: number }>();

  for (const attempt of session.attempts) {
    const current = skillScores.get(attempt.skillId) ?? { correct: 0, total: 0 };
    current.total += 1;
    current.correct += attempt.correct ? 1 : 0;
    skillScores.set(attempt.skillId, current);
  }

  const score = session.attempts.filter((attempt) => attempt.correct).length;
  const total = session.attempts.length;
  const ranked = [...skillScores.entries()].sort(
    (left, right) =>
      right[1].correct / right[1].total - left[1].correct / left[1].total,
  );

  return {
    score,
    total,
    percentage: total === 0 ? 0 : Math.round((score / total) * 100),
    strongSkillIds: ranked
      .filter(([, value]) => value.correct === value.total)
      .map(([skillId]) => skillId),
    reviewSkillIds: ranked
      .filter(([, value]) => value.correct < value.total)
      .map(([skillId]) => skillId),
  };
}

export function makeAttempt(
  exercise: Exercise,
  response: string[],
  durationMs: number,
): Attempt {
  return {
    exerciseId: exercise.id,
    skillId: exercise.skillId,
    track: exercise.track,
    type: exercise.type,
    response,
    correct: evaluateResponse(exercise, response),
    durationMs,
    completedAt: new Date().toISOString(),
  };
}
