import { companyWorlds } from "../src/lib/company-worlds";
import {
  allExercises,
  getCompanyEligibleExercises,
} from "../src/lib/exercise-bank";
import { buildSessionExercises } from "../src/lib/session";
import { isCompletedSession } from "../src/lib/session-validation";
import type {
  CompanyId,
  CompletedSession,
  Exercise,
  SessionMode,
  Track,
} from "../src/lib/domain";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function trackCount(exercises: Exercise[], track: Track) {
  return exercises.filter((exercise) => exercise.track === track).length;
}

function hasCompanyMotivation(exercises: Exercise[], companyId: CompanyId) {
  return exercises.some(
    (exercise) =>
      exercise.tags?.includes("company-motivation") &&
      (exercise.companyId === companyId ||
        exercise.answerExamples?.some(
          (example) => example.companyId === companyId,
        )),
  );
}

function assertSession(
  exercises: Exercise[],
  companyId: CompanyId,
  mode: "company" | "rapid-fire",
) {
  const expected = mode === "company"
    ? { size: 7, engineering: 5, interview: 2 }
    : { size: 5, engineering: 3, interview: 2 };
  assert(exercises.length === expected.size, `${companyId} ${mode}: wrong size`);
  assert(
    new Set(exercises.map((exercise) => exercise.id)).size === expected.size,
    `${companyId} ${mode}: duplicate exercise`,
  );
  assert(
    trackCount(exercises, "engineering") === expected.engineering,
    `${companyId} ${mode}: wrong engineering quota`,
  );
  assert(
    trackCount(exercises, "interview") === expected.interview,
    `${companyId} ${mode}: wrong interview quota`,
  );
  assert(
    exercises.every(
      (exercise) =>
        exercise.companyId === undefined || exercise.companyId === companyId,
    ),
    `${companyId} ${mode}: foreign company exercise`,
  );
  assert(
    exercises.every((exercise) =>
      (exercise.answerExamples ?? []).every(
        (example) =>
          example.companyId === undefined || example.companyId === companyId,
      ),
    ),
    `${companyId} ${mode}: foreign answer example`,
  );
  assert(
    hasCompanyMotivation(exercises, companyId),
    `${companyId} ${mode}: missing company motivation`,
  );
}

function sessionPayload(mode: SessionMode, companyId?: CompanyId): CompletedSession {
  return {
    id: `verify-${mode}`,
    mode,
    ...(companyId ? { companyId } : {}),
    startedAt: "2026-09-22T10:00:00.000Z",
    completedAt: "2026-09-22T10:05:00.000Z",
    attempts: [
      {
        exerciseId: allExercises[0].id,
        skillId: allExercises[0].skillId,
        track: allExercises[0].track,
        type: allExercises[0].type,
        response: ["verification"],
        correct: false,
        durationMs: 1000,
        completedAt: "2026-09-22T10:04:00.000Z",
      },
    ],
  };
}

for (const mode of ["daily", "engineering", "interview"] as const) {
  const exercises = buildSessionExercises(mode, { rng: seededRandom(7) });
  assert(exercises.length === 7, `${mode}: Phase 1 session size changed`);
  assert(
    exercises.every((exercise) => exercise.companyId === undefined),
    `${mode}: company-scoped content leaked into a Phase 1 mode`,
  );
  if (mode === "daily") {
    assert(trackCount(exercises, "engineering") === 4, "daily: wrong engineering quota");
    assert(trackCount(exercises, "interview") === 3, "daily: wrong interview quota");
  } else {
    assert(
      exercises.every((exercise) => exercise.track === mode),
      `${mode}: wrong track content`,
    );
  }
}

for (const world of companyWorlds) {
  for (let seed = 1; seed <= 500; seed += 1) {
    assertSession(
      buildSessionExercises(
        { mode: "company", companyId: world.id },
        { rng: seededRandom(seed) },
      ),
      world.id,
      "company",
    );
    assertSession(
      buildSessionExercises(
        { mode: "rapid-fire", companyId: world.id },
        { rng: seededRandom(seed), history: [] },
      ),
      world.id,
      "rapid-fire",
    );
  }

  const recentMiss = getCompanyEligibleExercises(world.id).find(
    (exercise) => exercise.track === "engineering",
  );
  assert(recentMiss, `${world.id}: no engineering exercise for miss reuse`);
  const history = sessionPayload("company", world.id);
  history.attempts[0] = {
    ...history.attempts[0],
    exerciseId: recentMiss.id,
    skillId: recentMiss.skillId,
    track: recentMiss.track,
    type: recentMiss.type,
  };
  const rapidFire = buildSessionExercises(
    { mode: "rapid-fire", companyId: world.id },
    { rng: seededRandom(42), history: [history] },
  );
  assert(
    rapidFire.some((exercise) => exercise.id === recentMiss.id),
    `${world.id}: Rapid Fire did not reuse an eligible recent miss`,
  );
}

assert(isCompletedSession(sessionPayload("daily")), "legacy session rejected");
assert(
  isCompletedSession(sessionPayload("company", "ashby")),
  "company session rejected",
);
assert(
  !isCompletedSession(sessionPayload("company")),
  "company session without companyId accepted",
);
assert(
  !isCompletedSession(sessionPayload("daily", "ashby")),
  "legacy session with companyId accepted",
);

console.log(
  `Phase 2 verified: ${allExercises.length} exercises, ${companyWorlds.length} worlds, 3,000 deterministic sessions.`,
);
