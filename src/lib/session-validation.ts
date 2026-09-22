import type {
  Attempt,
  CompanyId,
  CompletedSession,
  ExerciseType,
  SessionMode,
  Track,
} from "./domain";

const sessionModes = new Set<SessionMode>([
  "daily",
  "engineering",
  "interview",
  "company",
  "rapid-fire",
]);
const companyIds = new Set<CompanyId>(["ashby", "attio", "linear"]);
const tracks = new Set<Track>(["engineering", "interview"]);
const exerciseTypes = new Set<ExerciseType>([
  "choice",
  "multi-select",
  "ordering",
  "anchor-reconstruction",
]);

function isBoundedString(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maximumLength
  );
}

function isTimestamp(value: unknown): value is string {
  return isBoundedString(value, 50) && Number.isFinite(Date.parse(value));
}

function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<Attempt>;
  return (
    isBoundedString(attempt.exerciseId, 100) &&
    isBoundedString(attempt.skillId, 100) &&
    tracks.has(attempt.track as Track) &&
    exerciseTypes.has(attempt.type as ExerciseType) &&
    Array.isArray(attempt.response) &&
    attempt.response.length <= 50 &&
    attempt.response.every((item) => isBoundedString(item, 100)) &&
    typeof attempt.correct === "boolean" &&
    typeof attempt.durationMs === "number" &&
    Number.isFinite(attempt.durationMs) &&
    attempt.durationMs >= 0 &&
    isTimestamp(attempt.completedAt)
  );
}

export function isCompletedSession(value: unknown): value is CompletedSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<CompletedSession>;
  if (
    !isBoundedString(session.id, 100) ||
    !sessionModes.has(session.mode as SessionMode) ||
    !isTimestamp(session.startedAt) ||
    !isTimestamp(session.completedAt) ||
    !Array.isArray(session.attempts) ||
    session.attempts.length === 0 ||
    session.attempts.length > 20 ||
    !session.attempts.every(isAttempt)
  ) {
    return false;
  }

  if (session.mode === "company" || session.mode === "rapid-fire") {
    return companyIds.has(session.companyId as CompanyId);
  }

  return session.companyId === undefined;
}
