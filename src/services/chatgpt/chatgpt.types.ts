import { SpecializationSetting } from '../../models/settings/settings.types';

import { Resume } from '../resume/resume.types';

import { FormQuestion, Reply, Vacancy } from '../vacancy/vacancy.types';

// export interface GeneratedVacancyApplication {
//   link: string,
//   form?: FormsAnswers;
//   resumes: string[],
//   letter: string
// }

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
  callGPT<T>(dto: CallGptDto & { field: string }): Promise<T>;
  callGPT(dto: CallGptDto & { field?: undefined }): Promise<string>;
  generateLetter(vacancy: Vacancy): Promise<string>;
  generateVacancyFormAnswers(form: FormQuestion[]): Promise<FormsAnswers>
  generateChatReply(message: string): Promise<Reply>;
  generateResumeSelection(vacancyName: string, resumesList: string[]): Promise<string[]>,
}
