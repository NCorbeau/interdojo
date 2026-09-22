import { allExercises, allSkills } from "../src/lib/exercise-bank";
import { companyWorlds } from "../src/lib/company-worlds";
import type { Attempt, CompletedSession, Exercise, Track } from "../src/lib/domain";
import { deriveLearningState } from "../src/lib/learning-state";
import { buildSessionExercises, makeAttempt, summarizeSession } from "../src/lib/session";
import { isCompletedSession } from "../src/lib/session-validation";

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

function findExercise(id: string): Exercise {
  const exercise = allExercises.find((candidate) => candidate.id === id);
  assert(exercise, `Missing fixture exercise ${id}`);
  return exercise;
}

function attemptFor(id: string, correct: boolean, completedAt: string): Attempt {
  const exercise = findExercise(id);
  assert(exercise.type !== "self-check", `Fixture ${id} is not graded`);
  return {
    exerciseId: exercise.id,
    skillId: exercise.skillId,
    track: exercise.track,
    type: exercise.type,
    response: ["fixture"],
    correct,
    durationMs: 2000,
    completedAt,
    evidenceLevel: exercise.evidenceLevel,
    difficulty: exercise.difficulty ?? 1,
  };
}

function session(id: string, attempts: Attempt[]): CompletedSession {
  return {
    id,
    mode: "daily",
    startedAt: attempts[0].completedAt,
    completedAt: attempts[attempts.length - 1].completedAt,
    attempts,
  };
}

const now = Date.parse("2026-09-23T12:00:00.000Z");
const recent = "2026-09-23T10:00:00.000Z";
const old = "2026-09-10T10:00:00.000Z";
const dsMiss = session("ds-miss", [attemptFor("ds-ack-window", false, recent)]);
const nodeMiss = session("node-miss", [attemptFor("node-production-debug", false, recent)]);
const dsSuccesses = session("ds-recognition", [
  attemptFor("ds-ack-window", true, "2026-09-23T09:00:00.000Z"),
  attemptFor("ds-exactly-once", true, recent),
]);

const selfCheck = findExercise("ds3-explain-queue-crash");
assert(selfCheck.type === "self-check", "Expected self-check fixture");
const selfAttempt = {
  ...makeAttempt(selfCheck, ["needs-work"], 1000, "needs-work"),
  completedAt: recent,
};
assert(selfAttempt.correct === null, "Self-check was objectively graded");
assert(isCompletedSession(session("self-check", [selfAttempt])), "Self-check payload rejected");
assert(
  !isCompletedSession(session("invalid-self-check", [{ ...selfAttempt, correct: true }])),
  "Self-check accepted forged objective correctness",
);
assert(
  !isCompletedSession(session("invalid-graded", [{ ...attemptFor("ds-ack-window", true, recent), selfAssessment: "got-it" }])),
  "Graded answer accepted a self-rating",
);

const legacyAttempt = attemptFor("ds-ack-window", true, recent);
delete legacyAttempt.evidenceLevel;
delete legacyAttempt.difficulty;
assert(isCompletedSession(session("legacy", [legacyAttempt])), "Legacy session rejected");

const recognition = deriveLearningState([dsSuccesses], allSkills, now).get("distributed-systems");
assert(recognition?.highestObservedCorrectLevel === "recognize", "Recognition overstated evidence");
assert(recognition.recommendedLevel === "recall", "Repeated recognition did not suggest recall");
const selfState = deriveLearningState([session("self-check", [selfAttempt])], allSkills, now)
  .get("distributed-systems");
assert(!selfState?.highestObservedCorrectLevel, "Self-rating became graded evidence");
assert(selfState?.reason === "needs another spoken pass", "Self-reported need was ignored");
const selfGotIt = { ...selfAttempt, selfAssessment: "got-it" as const, response: ["got-it"] };
const selfOnly = deriveLearningState([session("self-only", [selfGotIt, {
  ...selfGotIt,
  completedAt: "2026-09-23T09:00:00.000Z",
}])], allSkills, now).get("distributed-systems");
assert(!selfOnly?.highestObservedCorrectLevel, "Repeated self-rating became graded evidence");
assert(selfOnly?.recommendedLevel === "recognize", "Self-rating alone promoted evidence level");

const missState = deriveLearningState([dsMiss], allSkills, now).get("distributed-systems");
assert(missState?.reason === "recent miss", "Recent graded miss was ignored");
const overdueState = deriveLearningState(
  [session("old-ds", [attemptFor("ds-ack-window", true, old)])],
  allSkills,
  now,
).get("distributed-systems");
assert(overdueState?.reason === "not practiced recently", "Overdue practice was ignored");
const oldMissState = deriveLearningState(
  [session("old-miss", [attemptFor("ds-ack-window", false, old)])],
  allSkills,
  now,
).get("distributed-systems");
assert(oldMissState?.reason === "not practiced recently", "Old miss was mislabeled as recent");

const mixedSummary = summarizeSession(session("mixed", [attemptFor("ds-ack-window", true, recent), selfAttempt]));
assert(mixedSummary.score === 1 && mixedSummary.gradedTotal === 1, "Self-rating entered graded accuracy");
assert(mixedSummary.reviewSkillIds.includes("distributed-systems"), "Self-reported review signal was lost");
assert(!mixedSummary.strongSkillIds.includes("distributed-systems"), "Conflicting strong/review skill shown");

function verifySession(exercises: Exercise[], expected: Record<Track, number>, maxPerSkill = 2) {
  assert(exercises.length === expected.engineering + expected.interview, "Wrong session size");
  assert(new Set(exercises.map((exercise) => exercise.id)).size === exercises.length, "Duplicate drill");
  for (const track of ["engineering", "interview"] as const) {
    assert(exercises.filter((exercise) => exercise.track === track).length === expected[track], `Wrong ${track} quota`);
  }
  assert(exercises.filter((exercise) => exercise.type === "self-check").length <= 2, "Too many self-checks");
  for (const skillId of new Set(exercises.map((exercise) => exercise.skillId))) {
    assert(exercises.filter((exercise) => exercise.skillId === skillId).length <= maxPerSkill, `${skillId} monopolized a sprint`);
  }
}

for (let seed = 1; seed <= 300; seed += 1) {
  for (const history of [[], [dsMiss], [nodeMiss], [dsSuccesses]]) {
    verifySession(buildSessionExercises("daily", { rng: seededRandom(seed), history, now }), {
      engineering: 4,
      interview: 3,
    });
  }
}

const afterDsMiss = buildSessionExercises("daily", { rng: seededRandom(42), history: [dsMiss], now });
const afterNodeMiss = buildSessionExercises("daily", { rng: seededRandom(42), history: [nodeMiss], now });
assert(afterDsMiss.some((exercise) => exercise.skillId === "distributed-systems" && exercise.selectionReason === "recent miss"), "DS miss did not focus next sprint");
assert(afterNodeMiss.some((exercise) => exercise.skillId === "node-runtime" && exercise.selectionReason === "recent miss"), "Node miss did not focus next sprint");
assert(
  afterDsMiss.map((exercise) => exercise.id).join() !== afterNodeMiss.map((exercise) => exercise.id).join(),
  "Distinct histories produced the same seeded second sprint",
);

for (const skillId of ["distributed-systems", "system-design"]) {
  const levels = new Set(allExercises.filter((exercise) => exercise.skillId === skillId).map((exercise) => exercise.evidenceLevel));
  assert(["recognize", "recall", "apply", "explain"].every((level) => levels.has(level as Exercise["evidenceLevel"])), `${skillId} has a missing evidence rung`);
}

for (const world of companyWorlds) {
  for (let seed = 1; seed <= 100; seed += 1) {
    const exercises = buildSessionExercises(
      { mode: "company", companyId: world.id },
      { rng: seededRandom(seed), history: [dsMiss], now },
    );
    verifySession(exercises, { engineering: 5, interview: 2 }, 5);
    assert(exercises.every((exercise) => !exercise.companyId || exercise.companyId === world.id), `${world.id} leaked another company's drill`);
    assert(exercises.every((exercise) => (exercise.answerExamples ?? []).every((example) => !example.companyId || example.companyId === world.id)), `${world.id} leaked another company's answer`);
    assert(exercises.some((exercise) => exercise.tags?.includes("company-motivation") &&
      (exercise.companyId === world.id || exercise.answerExamples?.some((example) => example.companyId === world.id))), `${world.id} lost company motivation`);
  }
}

console.log(`Phase 3 verified: ${allExercises.length} exercises, 1,200 seeded Daily Sprints, 300 adaptive Company Worlds, evidence and persistence contracts.`);
