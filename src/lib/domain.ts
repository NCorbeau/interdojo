export type Track = "engineering" | "interview";

export type CompanyId = "ashby" | "attio" | "linear";

export type PhaseOneSessionMode = "daily" | Track;

export type CompanySessionMode = "company" | "rapid-fire";

export type SessionMode = PhaseOneSessionMode | CompanySessionMode;

export type SessionRequest =
  | { mode: PhaseOneSessionMode }
  | { mode: CompanySessionMode; companyId: CompanyId };

export type ExerciseTag =
  | "react-typescript"
  | "api-backed-ui"
  | "node-runtime"
  | "product-judgment"
  | "domain-modeling"
  | "api-data"
  | "transactions"
  | "staff-judgment"
  | "state-architecture"
  | "realtime"
  | "performance"
  | "interaction-quality"
  | "distributed-systems"
  | "system-design"
  | "career-narrative"
  | "company-motivation"
  | "claim-boundaries"
  | "behavioral"
  | "ai-assisted-engineering";

export type SourceReference = {
  title: string;
  url: string;
};

export type TrackCounts = Record<Track, number>;

export type CompanyWorldSessionConfig = {
  size: number;
  trackCounts: TrackCounts;
};

export type CompanyWorld = {
  id: CompanyId;
  name: string;
  description: string;
  focusAreas: string[];
  source: SourceReference;
  tagWeights: Partial<Record<ExerciseTag, number>>;
  standard: CompanyWorldSessionConfig;
  rapidFire: CompanyWorldSessionConfig;
};

export type ExerciseType =
  | "choice"
  | "multi-select"
  | "ordering"
  | "anchor-reconstruction"
  | "self-check";

// A ceiling on the evidence this interaction can produce, not a mastery score.
export type EvidenceLevel = "recognize" | "recall" | "apply" | "explain";
export type Difficulty = 1 | 2 | 3;
export type SelfAssessment = "got-it" | "needs-work";

export type Skill = {
  id: string;
  name: string;
  track: Track;
};

export type AnswerOption = {
  id: string;
  label: string;
};

export type AnswerExample = {
  id: string;
  label: string;
  answer: string;
  companyId?: CompanyId;
  source?: SourceReference;
};

type ExerciseBase = {
  id: string;
  skillId: string;
  track: Track;
  type: ExerciseType;
  evidenceLevel: EvidenceLevel;
  difficulty?: Difficulty;
  eyebrow: string;
  prompt: string;
  instruction: string;
  explanation: string;
  selectionReason?: string;
  tags?: ExerciseTag[];
  companyId?: CompanyId;
  answerExamples?: AnswerExample[];
  source: SourceReference;
};

export type ChoiceExercise = ExerciseBase & {
  type: "choice";
  options: AnswerOption[];
  correctOptionId: string;
};

export type MultiSelectExercise = ExerciseBase & {
  type: "multi-select";
  options: AnswerOption[];
  correctOptionIds: string[];
};

export type OrderingExercise = ExerciseBase & {
  type: "ordering";
  items: AnswerOption[];
  correctOrder: string[];
};

export type AnchorExercise = ExerciseBase & {
  type: "anchor-reconstruction";
  anchors: AnswerOption[];
  correctOrder: string[];
};

export type SelfCheckExercise = ExerciseBase & {
  type: "self-check";
  evidenceLevel: "recall" | "explain";
  modelPoints: string[];
};

export type Exercise =
  | ChoiceExercise
  | MultiSelectExercise
  | OrderingExercise
  | AnchorExercise
  | SelfCheckExercise;

export type Attempt = {
  exerciseId: string;
  skillId: string;
  track: Track;
  type: ExerciseType;
  response: string[];
  // Null means there was no objective grading; selfAssessment records the learner's view.
  correct: boolean | null;
  evidenceLevel?: EvidenceLevel; // Absent on legacy attempts.
  difficulty?: Difficulty; // Absent on legacy attempts.
  selfAssessment?: SelfAssessment;
  durationMs: number;
  completedAt: string;
};

export type CompletedSession = {
  id: string;
  mode: SessionMode;
  companyId?: CompanyId;
  startedAt: string;
  completedAt: string;
  attempts: Attempt[];
};

export type SessionSummary = {
  score: number;
  total: number;
  gradedTotal: number;
  selfCheckCount: number;
  percentage: number;
  strongSkillIds: string[];
  reviewSkillIds: string[];
};
