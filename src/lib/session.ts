import { exercises } from "./exercises";
import type {
  Attempt,
  CompletedSession,
  Exercise,
  SessionMode,
  SessionSummary,
} from "./domain";

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function shuffledMultiSelectOptions(
  exercise: Extract<Exercise, { type: "multi-select" }>,
) {
  const options = shuffled(exercise.options);
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

function randomizePresentation(exercise: Exercise): Exercise {
  if (exercise.type === "choice") {
    return { ...exercise, options: shuffled(exercise.options) };
  }

  if (exercise.type === "multi-select") {
    return { ...exercise, options: shuffledMultiSelectOptions(exercise) };
  }

  if (exercise.type === "ordering") {
    return { ...exercise, items: shuffled(exercise.items) };
  }

  return { ...exercise, anchors: shuffled(exercise.anchors) };
}

export function buildSessionExercises(mode: SessionMode): Exercise[] {
  if (mode === "daily") {
    const engineering = shuffled(
      exercises.filter((exercise) => exercise.track === "engineering"),
    ).slice(0, 4);
    const interview = shuffled(
      exercises.filter((exercise) => exercise.track === "interview"),
    ).slice(0, 3);
    return shuffled([...engineering, ...interview]).map(randomizePresentation);
  }

  return shuffled(
    exercises.filter((exercise) => exercise.track === mode),
  )
    .slice(0, 7)
    .map(randomizePresentation);
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
