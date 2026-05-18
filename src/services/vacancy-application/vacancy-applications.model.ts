import { Schema, model } from 'mongoose';
import Joi from 'joi';

import {
  IVacancyApplicationModel, VacancyApplication, VacancyApplicationDocument, VacancyApplicationStatus,
} from './vacancy-applications.types';

import { AUTO_REPLY_INTERVAL_HOURS } from '../../common/constants/common';

const linkSchema = Joi.string()
  .uri()
  .pattern(/^https?:\/\/([\w-]+\.)?hh\.ru\//)
  .required()
  .messages({
    'string.pattern.base': 'Ссылка должна быть с домена hh.ru',
    'string.uri': 'Некорректный формат ссылки',
  });

const VacancyApplicationSchema = new Schema<VacancyApplicationDocument>({
  link: {
    type: String,
    required: true,
    validate: {
      validator: (value: string) => {
        const { error } = linkSchema.validate(value);
        return !error;
      },
      message: (props: { value: string }) => {
        const { error } = linkSchema.validate(props.value);
        return error?.message ?? 'Некорректная ссылка';
      },
    },
  },
  title: { type: String },
  company: { type: String },
  resumes: { type: [String] },
  description: { type: String },
  appliedResumes: { type: [String], default: [] },
  letter: { type: String },
  status: { type: String, required: true },
  isApplied: { type: Boolean, default: false },
  type: { type: String, default: 'vacancy' },
  lastMessage: { type: String, default: '' },
  isArchived: { type: Boolean, default: false },
  form: {
    type: {
      inputs: [
        {
          id: { type: String },
          value: { type: String },
        },
      ],
      options: [{ type: String }],
    },
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

VacancyApplicationSchema.statics.updateApplication = async function (
  vacancyApplication: VacancyApplication,
  appliedResume: string,
) {
  const { link, resumes } = vacancyApplication;

  const hasVacancy = await this.findOne({ link: vacancyApplication.link });

  const filtredResumes = resumes.filter((resume: string) => resume !== appliedResume);

  if (!hasVacancy) return;

  await this.updateOne(
    { link },
    {
      $set: {
        updatedAt: new Date(),
        resumes: filtredResumes,
        isApplied: true,
      },
      $addToSet: {
        appliedResumes: appliedResume,
      },
    },
  );
};

VacancyApplicationSchema.statics.createApplications = async function (
  vacancyApplications: VacancyApplication[],
) {
  await this.insertMany(
    vacancyApplications.map((vacancyApplication) => ({
      ...vacancyApplication,
      isApplied: false,
      appliedResumes: [],
      status: VacancyApplicationStatus.PENDING,
      type: 'vacancy',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
};

VacancyApplicationSchema.statics.getActualVacancyApplications = async function (): Promise<VacancyApplication[]> {
  const vacancies = await this.find({
    resumes: { $exists: true, $not: { $size: 0 } },
    isArchived: false,
    isApplied: true,
    status: { $ne: VacancyApplicationStatus.INTERVIEW },
    $or: [
      { status: VacancyApplicationStatus.REJECTION },
      {
        status: { $ne: VacancyApplicationStatus.REJECTION },
        updatedAt: {
          $lt: new Date(Date.now() - AUTO_REPLY_INTERVAL_HOURS),
        },
      },
    ],
  }).lean();

  return vacancies;
};

VacancyApplicationSchema.statics.getVacancyApplications = async function (): Promise<VacancyApplication[]> {
  const vacancyApplications = await this.find({
    resumes: { $exists: true, $not: { $size: 0 } },
    isApplied: false,
    isArchived: false,
  }).lean();

  return vacancyApplications;
};

VacancyApplicationSchema.statics.archiveVacancyApplication = async function (link: string) {
  return this.updateOne(
    { link },
    {
      $set: {
        isArchived: true,
        updatedAt: new Date(),
      },
    },
  );
};

// VacancyApplicationSchema.statics.getRecentInterviews = async function (): Promise<VacancyApplication[]> {
//   const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

//   const vacancies = await this.find({
//     isArchived: false,
//     status: VacancyApplicationStatus.INTERVIEW,
//     updatedAt: { $gte: oneWeekAgo },
//   }).lean();

//   return vacancies;
// };

export const VacancyApplicationModel = model<VacancyApplicationDocument, IVacancyApplicationModel>(
  'VacancyApplication',
  VacancyApplicationSchema,
);
