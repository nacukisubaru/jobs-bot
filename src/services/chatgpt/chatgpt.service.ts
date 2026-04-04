import { Vacancy } from '../vacancy/vacancy.types';
import { IGPTService } from './chatgpt.types';

export class GPTService implements IGPTService {
    async generateCoverLetter(vacancy: Vacancy): Promise<string> {
        // Моковая генерация письма
        return `Здравствуйте! Я хочу откликнуться на вакансию "${vacancy.title}"${vacancy.company ? ' в ' + vacancy.company : ''}. Моя сопроводилка готова!`;
    }

    async analyzeVacancy(vacancy: Vacancy): Promise<any> {
        // Моковый анализ вакансии
        return {
            title: vacancy.title,
            company: vacancy.company || 'Не указано',
            recommendedSkills: ['JavaScript', 'TypeScript', 'React'],
            summary: 'Вакансия подходит для фронтенд-разработчика.'
        };
    }
}