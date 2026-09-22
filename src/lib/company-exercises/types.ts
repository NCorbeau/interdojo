import type { CompanyId, Exercise } from "../domain";

export type CompanyExerciseModule = {
  companyId: CompanyId;
  exercises: Exercise[];
};

export function defineCompanyExercises(
  companyId: CompanyId,
  exercises: Exercise[],
): CompanyExerciseModule {
  for (const exercise of exercises) {
    if (exercise.companyId !== companyId) {
      throw new Error(
        `Exercise ${exercise.id} must declare companyId ${companyId}`,
      );
    }
  }

  return { companyId, exercises };
}
