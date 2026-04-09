import { Resume } from '../resume/resume.types';

import { VacancyApplication } from '../vacancy-application/vacancy-applications.types';

import { Vacancy } from '../vacancy/vacancy.types';

export interface IGPTService {
  generateVacancyApplications(vacancies: Vacancy[], resumes: Resume[]): Promise<VacancyApplication[]>;
}
