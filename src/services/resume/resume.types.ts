import { Document, Model } from 'mongoose';

export interface Experience {
  company: string;
  position: string;
  description: string;
  periods: {
    start: { month: string; year: string };
    end: { month: string; year: string };
  };
}

export interface Resume {
  profession: string;
  keywords: string[];
  experience: Experience[];
}

export interface ResumeDocument extends Resume, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IResumeModel extends Model<ResumeDocument> {
  createResume(data: Resume): Promise<ResumeDocument>;
  getResumesBySpec(specialization: number): Promise<Resume[]>;
  deleteAll(): Promise<number>;
}

export interface IResumeService {
  createResumes(): Promise<void>,
}
