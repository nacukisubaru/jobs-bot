import { VacancyApplicationStatus } from './vacancy-applications.types';

export const vacancyApplicationStatusMap = new Map<string, VacancyApplicationStatus>([
  ['Вам отказали', VacancyApplicationStatus.REJECTION],
  ['Вы откликнулись', VacancyApplicationStatus.PENDING],
  ['Вас пригласили', VacancyApplicationStatus.INTERVIEW],
]);
