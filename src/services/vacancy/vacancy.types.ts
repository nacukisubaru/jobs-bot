export interface Vacancy {
  link: string;
  title: string;
  company?: string;
  description?: string;
  form?: FormQuestion[];
}

export interface IVacancyFetcher {
  getVacancies(job: string): Promise<Vacancy[]>;
  markVacancySeen(url: string | string[]): Promise<void>;
}

export interface IVacancyChatService {
  processChats(): Promise<void>;
}

export type FormQuestion =
  | { id: string; question: string }
  | { question: string; options: { id: string, optionText: string } };

export interface Reply {
  type: 'message' | 'interview' | 'none',
  contact?: string,
  company?: string,
  messageToHR: string,
}

export interface ChatMessage {
  text: string;
  author: 'me' | 'hr';
  timestamp: string;
}
