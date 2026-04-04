export interface Vacancy {
    link: string;
    title: string;
    company?: string;
}

export interface IVacancyFetcher {
    getVacancies(): Promise<Vacancy[]>;
}