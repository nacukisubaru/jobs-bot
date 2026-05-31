import { SpecializationSetting } from '../../models/settings/settings.types';
import { FormsAnswers } from '../chatgpt/chatgpt.types';

export interface Vacancy {
  link: string;
  title: string;
  company?: string;
  description?: string;
  form?: FormsAnswers;
  resumes: string[];
  letter: string;
}

export interface IVacancyFetcher {
  getVacancies(specialization: SpecializationSetting): Promise<Vacancy[]>;
}

export interface IVacancyChatService {
  processChats(): Promise<void>;
}

export type FormQuestion =
  | { id: string; question: string }
  | { question: string; options: { id: string, optionText: string } };

export interface Reply {
  type: 'message' | 'interview' | 'none' | 'test-task' | 'form',
  contact?: string,
  company?: string,
  messageToHR: string,
}

export interface ChatMessage {
  text: string;
  author: 'me' | 'hr';
  timestamp: string;
}
