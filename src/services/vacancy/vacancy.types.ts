export interface Vacancy {
  link: string;
  title: string;
  company?: string;
  description?: string;
  form?: FormQuestion[];
}

export interface IVacancyFetcher {
  getVacancies(job: string): Promise<Vacancy[]>;
}

export type FormQuestion =
  | { id: string; question: string }
  | { question: string; options: { id: string, optionText: string } };
