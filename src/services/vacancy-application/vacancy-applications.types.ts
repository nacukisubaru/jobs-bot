import { Vacancy } from '../vacancy/vacancy.types';

export interface VacancyApplication extends Omit<Vacancy, 'description'> {
  resumes: string[],
  letter: string
}

export const enum VacancyApplicationStatus {
  REJECTION = 'rejection',
  PENDING = 'pending',
  INTERVIEW = 'interview',
  NONE = 'none',
}
