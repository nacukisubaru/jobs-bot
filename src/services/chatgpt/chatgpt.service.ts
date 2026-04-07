import OpenAI from 'openai';

import { Vacancy } from '../vacancy/vacancy.types';
import { Resume } from '../resume/resume.types';

import { IGPTService } from './chatgpt.types';
import { CHATGPT_MAX_VACANCY_PROMPT_TOKENS, CHATGPT_VACANCY_FILTER_PROMPT, CHATGPT_VACANCY_MATCH_AND_COVER_LETTER_PROMPT } from '../../common/constants/chatgpt';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type VacancyApplication = Omit<Vacancy, 'description'> & {
  resume: string,
  letter: string
};

export class GPTService implements IGPTService {
  // eslint-disable-next-line class-methods-use-this
  async generateVacancyApplications(vacancies: Vacancy[], resumes?: Resume[]): Promise<VacancyApplication[]> {
    const vacancyApplications: VacancyApplication[] = [];

    if (!vacancies.length) {
      return [];
    }

    const chunks: string[] = GPTService.prepareVacancyChunks(vacancies);
    const resumeText = GPTService.prepareResumeText(resumes);

    let prompt = CHATGPT_VACANCY_FILTER_PROMPT;

    if (resumeText) {
      prompt += `${CHATGPT_VACANCY_MATCH_AND_COVER_LETTER_PROMPT} прикладываю свои резюме ${resumeText}`;
    }

    for (const chunk of chunks) {
      try {
        const response = await client.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: chunk },
          ],
          response_format: {
            type: 'json_object',
          },
        });

        const content = response.choices[0].message?.content?.trim();

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

  private static prepareVacancyChunks(vacancies: Vacancy[]): string[] {
    const chunks: string[] = [];

    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    let text = '';

    for (let i = 0; i < vacancies.length; i++) {
      const vac = vacancies[i];
      const vacText = `[${vac.link || 'ссылка не указана'}] Название: ${vac.title} Компания: ${vac.company || 'Не указано'} Описание: ${vac.description}\n`;

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
