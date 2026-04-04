import { Vacancy } from "../vacancy/vacancy.types";

export interface IGPTService {
    generateCoverLetter(vacancy: Vacancy): Promise<string>;
    analyzeVacancy?(vacancy: Vacancy): Promise<any>; // дополнительный метод анализа вакансии, опционально
}