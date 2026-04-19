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

export interface Experience {
  company: string;
  position: string;
  description: string;
  periods: { month: string, year: string }[];
}

export interface GeneratedResume {
  profession: string;
  keywords: string[];
  experience: Experience[];
}

export interface IGPTService {
  generateVacancyApplications(vacancies: Vacancy[], resumes: Resume[]): Promise<VacancyApplication[]>;
  generateResumes(): Promise<GeneratedResume[]>;
}
