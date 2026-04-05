import OpenAI from 'openai';
import fetch from 'node-fetch';
import { Vacancy } from '../vacancy/vacancy.types';
import { IGPTService } from './chatgpt.types';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, fetch });

type AnalyzedVacancies = Omit<Vacancy, 'description'>[];

export class GPTService implements IGPTService {
  // eslint-disable-next-line class-methods-use-this
  async generateCoverLetter(vacancy: Vacancy): Promise<string> {
    // Моковая генерация письма
    return `Здравствуйте! Я хочу откликнуться на вакансию "${vacancy.title}"${vacancy.company ? ` в ${vacancy.company}` : ''}. Моя сопроводилка готова!`;
  }

  // eslint-disable-next-line class-methods-use-this
  async analyzeVacancies(vacancies: Vacancy[]): Promise<AnalyzedVacancies> {
    const MAX_TOKENS = 4000;
    const chunks: string[] = [];
    const currentChunk = '';

    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    vacancies.reduce((acc, vac, index) => {
      const vacText = `[${vac.link || 'ссылка не указана'}] Название: ${vac.title} Компания: ${vac.company || 'Не указано'} Описание: ${vac.description}\n`;

      if (estimateTokens(acc + vacText) > MAX_TOKENS || index === vacancies.length - 1) {
        chunks.push(acc);

        return vacText;
      }

      return acc + vacText;
    }, currentChunk);

    if (currentChunk) chunks.push(currentChunk);

    const results: AnalyzedVacancies = [];

    for (const chunk of chunks) {
      const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'Ты должен найти вакансии по реакту и только по реакту это должен быть фронтенд на реакте и ничего больше и вернуть только ссылки этих вакансий в виде массива объектов поля: link, title, company, ссылка которую ты берешь будет в каждой вакансии которую я тебе передаю.' },
          { role: 'user', content: chunk },
        ],
      });

      const content = response.choices[0].message?.content?.trim();

      if (content) {
        const parsedContent = JSON.parse(content);

        results.push(...parsedContent);
      }
    }

    return results;
  }
}
