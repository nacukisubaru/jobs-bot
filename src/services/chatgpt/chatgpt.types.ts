import { SpecializationSetting } from '../../models/settings/settings.types';

import { Resume } from '../resume/resume.types';

import { Vacancy } from '../vacancy/vacancy.types';

export interface GeneratedVacancyApplication {
  link: string,
  form?: FormsAnswers;
  resumes: string[],
  letter: string
}

export interface FormsAnswers {
  inputs: { id: string, value: string }[],
  options: string[]
}

export interface CallGptDto {
  prompt: string,
  content?: string,
  field?: string,
  max_completion_tokens?: number,
}

export interface IGPTService {
  generateVacancyApplications(
    vacancies: Vacancy[],
    specialization: SpecializationSetting,
    keywords: string,
  ): Promise<GeneratedVacancyApplication[]>;
  generateResumes(content: string): Promise<Resume[]>;
  analyzeInterviewPatterns(): Promise<string>;
}
