import { Model } from 'mongoose';
import { Page } from 'playwright';

import { VacancyApplication } from '../chatgpt/chatgpt.types';

export const enum VacancyApplicationStatus {
  REJECTION = 'rejection',
  PENDING = 'pending',
  INTERVIEW = 'interview',
  NONE = 'none',
}

export interface VacancyApplicationDocument extends Omit<VacancyApplication, 'resume'>, Document {
  status: VacancyApplicationStatus;
  resumes: string[];
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
}

export interface SubmitApplyArgs {
  page: Page;
  vacancy: VacancyApplication;
  currentStatus: VacancyApplicationStatus;
  appliedResume: string;
}
