import OpenAI from 'openai';

import { Vacancy } from '../vacancy/vacancy.types';
import { Resume } from '../resume/resume.types';

import { GeneratedResume, IGPTService, VacancyApplication } from './chatgpt.types';

import {
  CHATGPT_ASK_FORM_QUESTION_PROMPT,
  CHATGPT_MAX_VACANCY_PROMPT_TOKENS,
  CHATGPT_VACANCY_FILTER_PROMPT,
  CHATGPT_VACANCY_MATCH_AND_COVER_LETTER_PROMPT,
} from '../../common/constants/chatgpt';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';

export class GPTService implements IGPTService {
  private clinet: OpenAI;

  constructor() {
    this.clinet = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateVacancyApplications(vacancies: Vacancy[], resumes?: Resume[]): Promise<VacancyApplication[]> {
    const vacancyApplications: VacancyApplication[] = [];

    if (!vacancies.length) {
      return [];
    }

    const chunks: string[] = await GPTService.prepareVacancyChunks(vacancies);

    const resumeText = GPTService.prepareResumeText(resumes);

    let prompt = CHATGPT_VACANCY_FILTER_PROMPT;

    if (resumeText) {
      prompt += `${CHATGPT_VACANCY_MATCH_AND_COVER_LETTER_PROMPT} прикладываю свои резюме ${resumeText}`;
    }

    if (vacancies.find((vac) => vac.form)) {
      prompt += CHATGPT_ASK_FORM_QUESTION_PROMPT;
    }

    for (const chunk of chunks) {
      try {
        const content = await this.callGPT(prompt, chunk);

        if (content) {
          const parsedContent = JSON.parse(content);

          if (parsedContent && typeof parsedContent === 'object' && Array.isArray(parsedContent.vacancies)) {
            vacancyApplications.push(...parsedContent.vacancies);
          } else {
            logger.warn(AppErrorName.CHATGPT_UNEXPECTED_RESPONSE_FORMAT, { content });
          }
        }
      } catch (err) {
        const errorName = AppErrorName.CHATGPT_GENERATION_ERROR;

        logger.error(errorName, err);

        throw new AppException(
          errorName,
          { status: HttpStatus.BAD_REQUEST, cause: err },
        );
      }
    }

    return vacancyApplications;
  }

  async generateResumes(): Promise<GeneratedResume[]> {
    return [{
      profession: `Программист-${crypto.randomUUID()}`,
      keywords: ['JavaScript', 'TypeScript'],
      experience: [
        {
          company: 'Компания 1',
          position: 'Должность 1',
          description: 'Описание опыта 1',
          periods: [{ month: '02', year: '2020' }, { month: '05', year: '2021' }],
        },
        {
          company: 'Компания 2',
          position: 'Должность 2',
          description: 'Описание опыта 2',
          periods: [{ month: '06', year: '2021' }, { month: '08', year: '2023' }],
        },
        {
          company: 'Компания 3',
          position: 'Должность 3',
          description: 'Описание опыта 3',
          periods: [{ month: '07', year: '2023' }, { month: '08', year: '2024' }],
        },
        {
          company: 'Компания 4',
          position: 'Должность 4',
          description: 'Описание опыта 4',
          periods: [{ month: '09', year: '2024' }, { month: '10', year: '2025' }],
        },
      ],
    }];
  }

  private async callGPT(prompt: string, chunk: string): Promise<string | undefined> {
    const response = await this.clinet.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: chunk },
      ],
      response_format: {
        type: 'json_object',
      },
    });

    return response.choices[0].message?.content?.trim();
  }

  private static async prepareVacancyChunks(vacancies: Vacancy[]): Promise<string[]> {
    const chunks: string[] = [];

    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    let text = '';

    for (let i = 0; i < vacancies.length; i++) {
      const vac = vacancies[i];

      const vacText = `
        [${vac.link || 'ссылка не указана'}] 
        Название: ${vac.title} 
        Компания: ${vac.company || 'Не указано'}
        Описание: ${vac.description}\n
        Форма: ${vac.form ? JSON.stringify(vac.form) : 'Нет формы'}
      `;

      if (estimateTokens(text + vacText) > CHATGPT_MAX_VACANCY_PROMPT_TOKENS) {
        chunks.push(text);

        text = vacText;
      } else {
        text += vacText;
      }

      if (i === vacancies.length - 1 && text) {
        chunks.push(text);
      }
    }

    return chunks;
  }

  private static prepareResumeText(resumes?: Resume[]): string {
    if (!resumes || resumes.length === 0) return '';

    return resumes
      .map((resume) => `Название: ${resume.title} Описание: ${resume.content}`)
      .join('\n\n');
  }
}
