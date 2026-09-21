export type Track = "engineering" | "interview";

export type SessionMode = "daily" | Track;

export type ExerciseType =
  | "choice"
  | "multi-select"
  | "ordering"
  | "anchor-reconstruction";

export type Skill = {
  id: string;
  name: string;
  track: Track;
};

export type AnswerOption = {
  id: string;
  label: string;
};

type ExerciseBase = {
  id: string;
  skillId: string;
  track: Track;
  type: ExerciseType;
  eyebrow: string;
  prompt: string;
  instruction: string;
  explanation: string;
  source: {
    title: string;
    url: string;
  };
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

export type Exercise =
  | ChoiceExercise
  | MultiSelectExercise
  | OrderingExercise
  | AnchorExercise;

export type Attempt = {
  exerciseId: string;
  skillId: string;
  track: Track;
  type: ExerciseType;
  response: string[];
  correct: boolean;
  durationMs: number;
  completedAt: string;
};

export type CompletedSession = {
  id: string;
  mode: SessionMode;
  startedAt: string;
  completedAt: string;
  attempts: Attempt[];
};

export type SessionSummary = {
  score: number;
  total: number;
  percentage: number;
  strongSkillIds: string[];
  reviewSkillIds: string[];
};
