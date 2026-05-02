import { Model } from 'mongoose';
import { Page } from 'playwright';

import { GeneratedVacancyApplication } from '../chatgpt/chatgpt.types';

import { Vacancy } from '../vacancy/vacancy.types';

export type VacancyApplication = Omit<Vacancy, 'form'> & GeneratedVacancyApplication;

export const enum VacancyApplicationStatus {
  REJECTION = 'rejection',
  PENDING = 'pending',
  INTERVIEW = 'interview',
  NONE = 'none',
}

export interface VacancyApplicationDocument extends Omit<VacancyApplication, 'resume'>, Document {
  status: VacancyApplicationStatus;
  resumes: string[];
  description: string;
  appliedResumes: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVacancyApplicationModel extends Model<VacancyApplicationDocument> {
  createApplication(
    vacancyApplication: VacancyApplication,
    status: VacancyApplicationStatus,
    appliedResume: string
  ): Promise<void>;
  canApplyToVacancy(link: string): Promise<boolean>;
  getActualVacancyApplications: () => Promise<VacancyApplication[]>;
  isAlreadyApplied(link: string): Promise<boolean>;
  getVacanciesByStatus(status: VacancyApplicationStatus): Promise<VacancyApplication[]>;
  getRecentInterviews(): Promise<VacancyApplication[]>;
}

export interface SubmitApplyArgs {
  page: Page;
  vacancy: VacancyApplication;
  currentStatus: VacancyApplicationStatus;
  appliedResume: string;
}
