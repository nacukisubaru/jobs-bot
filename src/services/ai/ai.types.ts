import { FormQuestion, Reply, Vacancy } from '../vacancy/vacancy.types';
import { Resume } from '../resume/resume.types';
import { FormsAnswers, CallAIDto } from './providers/ai-provider.types';

export interface IAiService {
  call<T>(dto: CallAIDto & { field: string }): Promise<T>;
  call(dto: CallAIDto & { field?: undefined }): Promise<string>;
  generateLetter(vacancy: Vacancy): Promise<string>;
  generateVacancyFormAnswers(form: FormQuestion[]): Promise<FormsAnswers>;
  generateChatReply(message: string): Promise<Reply>;
  generateResumeSelection(vacancyName: string, resumesList: string[]): Promise<string[]>;
  generateResumes(): Promise<Resume[]>;
}
