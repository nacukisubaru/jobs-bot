import OpenAI from 'openai';

import { Vacancy } from '../vacancy/vacancy.types';
import { Resume } from '../resume/resume.types';

import { IGPTService } from './chatgpt.types';
import { CHATGPT_MAX_VACANCY_PROMPT_TOKENS, CHATGPT_VACANCY_FILTER_PROMPT, CHATGPT_VACANCY_MATCH_AND_COVER_LETTER_PROMPT } from '../../common/constants/chatgpt';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type VacancyApplication = Omit<Vacancy, 'description'> & {
  resume: string,
  letter: string
};

export class GPTService implements IGPTService {
  // eslint-disable-next-line class-methods-use-this
  async generateVacancyApplications(vacancies: Vacancy[], resumes?: Resume[]): Promise<VacancyApplication[]> {
    const chunks: string[] = [];

    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    vacancies.reduce((acc, vac, index) => {
      const vacText = `[${vac.link || 'ссылка не указана'}] Название: ${vac.title} Компания: ${vac.company || 'Не указано'} Описание: ${vac.description}\n`;

      if (estimateTokens(acc + vacText) > CHATGPT_MAX_VACANCY_PROMPT_TOKENS || index === vacancies.length - 1) {
        chunks.push(acc || vacText);

        return vacText;
      }

      return acc + vacText;
    }, '');

    let resumeText = '';

    if (resumes) {
      resumeText = resumes
        .map((resume) => `Название: ${resume.title} Описание: ${resume.content}`)
        .join('\n\n');
    }

    const vacancyApplications: VacancyApplication[] = [];

    let prompt = CHATGPT_VACANCY_FILTER_PROMPT;

    if (resumeText) {
      prompt += `${CHATGPT_VACANCY_MATCH_AND_COVER_LETTER_PROMPT} прикладываю свои резюме ${resumeText}`;
    }

    for (const chunk of chunks) {
      const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: chunk },
        ],
      });

      const content = response.choices[0].message?.content?.trim();

      if (content) {
        const parsedContent = JSON.parse(content);

        vacancyApplications.push(...parsedContent);
      }
    }

    return vacancyApplications;
  }
}
