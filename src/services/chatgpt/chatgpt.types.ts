import { Resume } from '../resume/resume.types';

import { Vacancy } from '../vacancy/vacancy.types';

export interface VacancyApplication extends Omit<Vacancy, 'description' | 'form'> {
  form?: FormsAnswers;
  resumes: string[],
  letter: string
}

export interface FormsAnswers {
  inputs: { id: string, value: string }[],
  options: string[]
}

export interface IGPTService {
  generateVacancyApplications(vacancies: Vacancy[], resumes: Resume[]): Promise<VacancyApplication[]>;
}
