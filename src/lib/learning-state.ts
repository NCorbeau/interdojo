import type {
  Attempt,
  CompletedSession,
  EvidenceLevel,
  Skill,
} from "./domain";

const evidenceOrder: EvidenceLevel[] = ["recognize", "recall", "apply", "explain"];
const staleAfterMs = 5 * 24 * 60 * 60 * 1000;
const recentWindowMs = 7 * 24 * 60 * 60 * 1000;

export type PracticeReason =
  | "recent miss"
  | "needs another spoken pass"
  | "not practiced recently"
  | "ready for a harder version"
  | "limited evidence"
  | "fresh practice";

export type SkillLearningState = {
  skillId: string;
  lastPracticedAt?: string;
  // This reports observed graded answers, not a claim that the skill is mastered.
  highestObservedCorrectLevel?: EvidenceLevel;
  recentGradedMisses: number;
  recentSelfReportedNeedsWork: number;
  recommendedLevel: EvidenceLevel;
  priority: number;
  reason: PracticeReason;
};

export function attemptEvidenceLevel(attempt: Attempt): EvidenceLevel {
  if (attempt.evidenceLevel) return attempt.evidenceLevel;
  // Old payloads had no evidence metadata. This is a conservative interpretation.
  return attempt.type === "ordering" || attempt.type === "anchor-reconstruction"
    ? "apply"
    : "recognize";
}

function nextLevel(level: EvidenceLevel): EvidenceLevel {
  return evidenceOrder[Math.min(evidenceOrder.indexOf(level) + 1, evidenceOrder.length - 1)];
}

export function deriveLearningState(
  history: readonly CompletedSession[],
  skills: readonly Skill[],
  now: number = Date.now(),
): Map<string, SkillLearningState> {
  const attemptsBySkill = new Map<string, Attempt[]>();
  for (const session of history) {
    for (const attempt of session.attempts) {
      const attempts = attemptsBySkill.get(attempt.skillId) ?? [];
      attempts.push(attempt);
      attemptsBySkill.set(attempt.skillId, attempts);
    }
  }

  const result = new Map<string, SkillLearningState>();
  for (const skill of skills) {
    const attempts = (attemptsBySkill.get(skill.id) ?? []).sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt) ||
        left.exerciseId.localeCompare(right.exerciseId),
    );
    const recent = attempts
      .filter((attempt) => now - Date.parse(attempt.completedAt) <= recentWindowMs)
      .slice(0, 4);
    const highestObservedCorrectLevel = attempts
      .filter((attempt) => attempt.correct === true)
      .map(attemptEvidenceLevel)
      .sort((left, right) => evidenceOrder.indexOf(right) - evidenceOrder.indexOf(left))[0];
    const recentGradedMisses = recent.filter((attempt) => attempt.correct === false).length;
    const recentSelfReportedNeedsWork = recent.filter(
      (attempt) => attempt.selfAssessment === "needs-work",
    ).length;
    const lastPracticedAt = attempts[0]?.completedAt;
    const stale = Boolean(
      lastPracticedAt && now - Date.parse(lastPracticedAt) >= staleAfterMs,
    );
    const latest = recent[0];
    const recentSameLevelSuccesses = highestObservedCorrectLevel
      ? recent.filter(
          (attempt) =>
            attempt.correct === true &&
            attemptEvidenceLevel(attempt) === highestObservedCorrectLevel,
        ).length
      : 0;
    const readyForHarder =
      recentGradedMisses === 0 &&
      recentSelfReportedNeedsWork === 0 &&
      recentSameLevelSuccesses >= 2;

    let reason: PracticeReason = "fresh practice";
    let priority = 1;
    if (latest?.correct === false || recentGradedMisses >= 2) {
      reason = "recent miss";
      priority = 7;
    } else if (latest?.selfAssessment === "needs-work" || recentSelfReportedNeedsWork >= 2) {
      reason = "needs another spoken pass";
      priority = 6;
    } else if (stale) {
      reason = "not practiced recently";
      priority = 5;
    } else if (readyForHarder) {
      reason = "ready for a harder version";
      priority = 4;
    } else if (!highestObservedCorrectLevel) {
      reason = "limited evidence";
      priority = attempts.length > 0 ? 3 : 2;
    }

    result.set(skill.id, {
      skillId: skill.id,
      ...(lastPracticedAt ? { lastPracticedAt } : {}),
      ...(highestObservedCorrectLevel ? { highestObservedCorrectLevel } : {}),
      recentGradedMisses,
      recentSelfReportedNeedsWork,
      recommendedLevel: readyForHarder && highestObservedCorrectLevel
        ? nextLevel(highestObservedCorrectLevel)
        : highestObservedCorrectLevel ?? "recognize",
      priority,
      reason,
    });
  }

  return result;
}
