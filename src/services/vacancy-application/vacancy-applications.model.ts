import { Schema, model } from 'mongoose';

import {
  IVacancyApplicationModel, VacancyApplication, VacancyApplicationDocument, VacancyApplicationStatus,
} from './vacancy-applications.types';

import { AUTO_REPLY_INTERVAL_HOURS } from '../../common/constants/common';

const VacancyApplicationSchema = new Schema<VacancyApplicationDocument>({
  link: { type: String, required: true },
  title: { type: String },
  company: { type: String },
  resumes: { type: [String] },
  description: { type: String },
  appliedResumes: { type: [String], default: [] },
  letter: { type: String },
  status: { type: String, required: true },
  type: { type: String, default: 'vacancy' },
  lastMessage: { type: String, default: '' },
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

VacancyApplicationSchema.statics.createApplication = async function (
  vacancyApplication: VacancyApplication,
  status: VacancyApplicationStatus,
  appliedResume: string,
  isArchived = false,
) {
  const { link, resumes } = vacancyApplication;

  const hasVacancy = await this.findOne({ link: vacancyApplication.link });

  const filtredResumes = resumes.filter((resume: string) => resume !== appliedResume);

  if (hasVacancy) {
    await this.updateOne(
      { link },
      {
        $set: {
          isArchived,
          updatedAt: new Date(),
          resumes: filtredResumes,
        },
        $addToSet: {
          appliedResumes: appliedResume,
        },
      },
    );

    return;
  }

  await this.create({
    ...vacancyApplication,
    resumes: filtredResumes,
    appliedResumes: [appliedResume],
    status: VacancyApplicationStatus.PENDING,
    type: 'vacancy',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

VacancyApplicationSchema.statics.canApplyToVacancy = async function (link: string) {
  const vacancy = await this.findOne({ link });

  if (!vacancy || vacancy.status === VacancyApplicationStatus.REJECTION) {
    return true;
  }

  const diff = Date.now() - new Date(vacancy.updatedAt).getTime();

  const allowed = diff > AUTO_REPLY_INTERVAL_HOURS * 60 * 60 * 1000;

  return allowed;
};

VacancyApplicationSchema.statics.isAlreadyApplied = async function (link: string) {
  const vacancy = await this.findOne({ link });

  if (vacancy) {
    return true;
  }

  return false;
};

VacancyApplicationSchema.statics.getActualVacancyApplications = async function (): Promise<VacancyApplication[]> {
  const vacancies = await this.find({
    resumes: { $exists: true, $not: { $size: 0 } },
    isArchived: false,
  }).lean();

  return vacancies;
};

VacancyApplicationSchema.statics.getVacanciesByStatus = async function (
  status: VacancyApplicationStatus,
): Promise<VacancyApplication[]> {
  const vacancies = await this.find({
    isArchived: false,
    status,
  }).lean();

  return vacancies;
};

VacancyApplicationSchema.statics.getRecentInterviews = async function (): Promise<VacancyApplication[]> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const vacancies = await this.find({
    isArchived: false,
    status: VacancyApplicationStatus.INTERVIEW,
    updatedAt: { $gte: oneWeekAgo },
  }).lean();

  return vacancies;
};

export const VacancyApplicationModel = model<VacancyApplicationDocument, IVacancyApplicationModel>(
  'VacancyApplication',
  VacancyApplicationSchema,
);
