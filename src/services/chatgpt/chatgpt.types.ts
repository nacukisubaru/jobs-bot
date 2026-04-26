import { Resume } from '../resume/resume.types';

import { Vacancy } from '../vacancy/vacancy.types';

export interface VacancyApplication extends Omit<Vacancy, 'form'> {
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
  periods: { start: { month: string, year: string }, end: { month: string, year: string } };
}

export interface GeneratedResume {
  profession: string;
  keywords: string[];
  experience: Experience[];
}

export interface CallGptDto {
  prompt: string,
  content?: string,
  field: string,
  max_completion_tokens?: number,
}

export interface IGPTService {
  generateVacancyApplications(vacancies: Vacancy[], resumes: Resume[]): Promise<VacancyApplication[]>;
  generateResumes(content: string): Promise<GeneratedResume[]>;
}
