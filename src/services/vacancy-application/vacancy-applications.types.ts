import { Model } from 'mongoose';
import { Page } from 'playwright';

import {
  FormsAnswers,
  // GeneratedVacancyApplication
} from '../ai/providers/ai-provider.types';

import { Vacancy } from '../vacancy/vacancy.types';

// export type VacancyApplication = Omit<Vacancy, 'form'>;
// & GeneratedVacancyApplication;

export const enum VacancyApplicationStatus {
  REJECTION = 'rejection',
  PENDING = 'pending',
  INTERVIEW = 'interview',
}

export interface VacancyApplicationDocument extends Omit<Vacancy, 'resume'>, Document {
  status: VacancyApplicationStatus;
  resumes: string[];
  description: string;
  type: 'vacancy' | 'chat',
  isApplied: boolean;
  appliedResumes: string[];
  isArchived: boolean;
  lastMessage: string;
  form: FormsAnswers,
  createdAt: Date;
  updatedAt: Date;
}

export interface IVacancyApplicationModel extends Model<VacancyApplicationDocument> {
  createApplications(
    vacancyApplication: Vacancy[],
  ): Promise<void>;
  createApplication(
    vacancyApplication: Vacancy,
  ): Promise<void>;
  updateApplication(
    vacancyApplication: Vacancy,
    appliedResume: string
  ): Promise<void>;
  getActualVacancyApplications: () => Promise<Vacancy[]>;
  getVacancyApplications: () => Promise<Vacancy[]>;
  archiveVacancyApplication: (link: string) => Promise<void>;
  // getRecentInterviews(): Promise<VacancyApplication[]>;
}

export interface SubmitApplyArgs {
  page: Page;
  vacancy: Vacancy;
  appliedResume: string;
}
