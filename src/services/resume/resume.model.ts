// resume.schema.ts
import { Schema, model } from 'mongoose';

import { IResumeModel, Resume, ResumeDocument } from './resume.types';

const ExperienceSchema = new Schema(
  {
    company: { type: String, required: true },
    position: { type: String, required: true },
    description: { type: String, required: true },
    periods: {
      start: {
        month: { type: String, required: true },
        year: { type: String, required: true },
      },
      end: {
        month: { type: String, required: true },
        year: { type: String, required: true },
      },
    },
  },
  { _id: false },
);

const ResumeSchema = new Schema<ResumeDocument>(
  {
    profession: {
      type: String,
      required: true,
    },
    keywords: {
      type: [String],
      required: true,
      default: [],
    },
    experience: {
      type: [ExperienceSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

ResumeSchema.statics.createResume = async function (
  data: Resume,
): Promise<ResumeDocument> {
  const resume = await this.create({
    ...data,
  });
  return resume;
};

ResumeSchema.statics.deleteAll = async function (): Promise<number> {
  const result = await this.deleteMany({});

  return result.deletedCount;
};

ResumeSchema.statics.getResumesBySpec = async function (specialization: number): Promise<Resume[]> {
  return this.find({ specialization }).lean();
};

export const ResumeModel = model<ResumeDocument, IResumeModel>(
  'Resume',
  ResumeSchema,
);
