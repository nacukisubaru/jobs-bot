import { Resume } from '../resume/resume.types';
import { Vacancy } from '../vacancy/vacancy.types';
import { VacancyApplication } from './chatgpt.service';

export interface IGPTService {
  generateVacancyApplications(vacancies: Vacancy[], resumes: Resume[]): Promise<VacancyApplication[]>;
}
