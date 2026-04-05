import { Vacancy } from '../vacancy/vacancy.types';

export interface IGPTService {
  generateCoverLetter(vacancy: Vacancy): Promise<string>;
  analyzeVacancies(vacancies: Vacancy[]): Promise<any>; // дополнительный метод анализа вакансии, опционально
}
