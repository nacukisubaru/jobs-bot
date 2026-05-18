import { Model } from 'mongoose';
import { Page } from 'playwright';

import { FormsAnswers, GeneratedVacancyApplication } from '../chatgpt/chatgpt.types';

import { Vacancy } from '../vacancy/vacancy.types';

export type VacancyApplication = Omit<Vacancy, 'form'> & GeneratedVacancyApplication;

export const enum VacancyApplicationStatus {
  REJECTION = 'rejection',
  PENDING = 'pending',
  INTERVIEW = 'interview',
}

export interface VacancyApplicationDocument extends Omit<VacancyApplication, 'resume'>, Document {
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
    vacancyApplication: VacancyApplication[],
  ): Promise<void>;
  updateApplication(
    vacancyApplication: VacancyApplication,
    appliedResume: string
  ): Promise<void>;
  getActualVacancyApplications: () => Promise<VacancyApplication[]>;
  getVacancyApplications: () => Promise<VacancyApplication[]>;
  archiveVacancyApplication: (link: string) => Promise<void>;
  // getRecentInterviews(): Promise<VacancyApplication[]>;
}

export interface SubmitApplyArgs {
  page: Page;
  vacancy: VacancyApplication;
  appliedResume: string;
}
