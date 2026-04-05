export interface Vacancy {
  link: string;
  title: string;
  company?: string;
  description: string;
}

export interface IVacancyFetcher {
  getVacancies(onProgress?: (progress: number) => void): Promise<Vacancy[]>;
}
