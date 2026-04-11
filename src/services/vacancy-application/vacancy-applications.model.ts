import { Schema, model } from 'mongoose';

import { IVacancyApplicationModel, VacancyApplicationDocument, VacancyApplicationStatus } from './vacancy-applications.types';
import { vacancyApplicationStatusMap } from './vacancy-applications.constants';

import { AUTO_REPLY_INTERVAL_HOURS } from '../../common/constants/common';

import { VacancyApplication } from '../chatgpt/chatgpt.types';

const VacancyApplicationSchema = new Schema<VacancyApplicationDocument>({
  link: { type: String, required: true },
  title: { type: String, required: true },
  company: { type: String },
  resumes: { type: [String], required: true },
  appliedResumes: { type: [String], default: [] },
  letter: { type: String, required: true },
  status: { type: String, required: true },
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

  const vacancyStatus = vacancyApplicationStatusMap.get(status) || VacancyApplicationStatus.NONE;

  const hasVacancy = await this.findOne({ link: vacancyApplication.link });

  const filtredResumes = resumes.filter((resume: string) => resume !== appliedResume);

  if (hasVacancy) {
    await this.updateOne(
      { link },
      {
        $set: {
          status: vacancyStatus,
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

  await this.insertOne({
    ...vacancyApplication,
    resumes: filtredResumes,
    appliedResumes: [appliedResume],
    status: vacancyStatus,
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

export const VacancyApplicationModel = model<VacancyApplicationDocument, IVacancyApplicationModel>(
  'VacancyApplication',
  VacancyApplicationSchema,
);
