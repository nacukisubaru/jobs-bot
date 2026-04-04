import { IVacancyFetcher, Vacancy } from "./vacancy.types";

export class VacancyService implements IVacancyFetcher {
    async getVacancies(): Promise<Vacancy[]> {
        // Моковые данные, возвращаем статический массив
        return [
            { link: 'https://hh.ru/vacancy/131837099?hhtmFromLabel=suitable_vacancies&hhtmFrom=vacancy', title: 'Backend Developer' },
            // { link: 'https://hh.ru/vacancy/131781036?hhtmFromLabel=suitable_vacancies_sidebar&hhtmFrom=vacancy', title: 'Frontend Developer' },
            // { link: 'https://hh.ru/vacancy/3', title: 'Fullstack Developer', company: 'TechCorp' },
        ];
    }
}