import OpenAI from 'openai';

import { Vacancy } from '../vacancy/vacancy.types';
import { Resume } from '../resume/resume.types';

import {
  CallGptDto, GeneratedResume, IGPTService, VacancyApplication,
} from './chatgpt.types';

import {
  CHATGPT_ASK_FORM_QUESTION_PROMPT,
  CHATGPT_CREATE_RESUMES_PROMPT,
  CHATGPT_MAX_VACANCY_PROMPT_TOKENS,
  CHATGPT_VACANCY_FILTER_PROMPT,
  CHATGPT_VACANCY_MATCH_AND_COVER_LETTER_PROMPT,
} from '../../common/constants/chatgpt';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';
import { SettingsModel } from '../../models/settings/settings.model';
import { format } from '../../common/utils/format';

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
      const vacancyApplicationsResponse = await this.callGPT<VacancyApplication>({
        prompt,
        content: chunk,
        field: 'vacancies',
      });

      if (vacancyApplicationsResponse) {
        vacancyApplications.push(...vacancyApplicationsResponse);
      }
    }

    return vacancyApplications;
  }

  async generateResumes(content: string): Promise<GeneratedResume[]> {
    const resumeSettings = await SettingsModel.getByKey('resume');
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    if (!resumeSettings) {
      throw new AppException(AppErrorName.RESUME_SETTINGS_NOT_FOUND, {
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (!careerSettings) {
      throw new AppException(AppErrorName.CAREER_SETTINGS_NOT_FOUND, {
        status: HttpStatus.NOT_FOUND,
      });
    }

    const { resumeExamples, experiencePeriods } = resumeSettings.value;

    if (!resumeExamples || !experiencePeriods) {
      throw new AppException(AppErrorName.RESUME_SETTINGS_INCOMPLETE, {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const { specializations, contacts } = careerSettings.value;

    if (!specializations || !specializations.length || !contacts) {
      throw new AppException(AppErrorName.CAREER_SETTINGS_INCOMPLETE, {
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const companiesText = resumeExamples.map((example: any) => example.company).join(', ');
    const experienceText = resumeExamples.map((example: any) => `Компания: ${example.company}, Описание: ${example.experience}`).join('\n\n');
    const specializationsText = specializations.join(', ');

    const prompt = format(
      CHATGPT_CREATE_RESUMES_PROMPT,
      {
        specializations: specializationsText,
        companies: companiesText,
        resumeExamples: experienceText,
        contacts,
        experienceCount: resumeExamples.length,
        resumesCount: specializations.length,
        vacancies: content,
      },
    );

    const generatedResumes: GeneratedResume[] | undefined = await this.callGPT({
      prompt, content, field: 'resumes', max_completion_tokens: 10000,
    });

    if (!generatedResumes) {
      return [];
    }

    return generatedResumes.map((resume) => {
      const experience = resume.experience.map((exp, index) => ({
        ...exp,
        periods: experiencePeriods[index] || [],
      }));

      return {
        ...resume,
        experience,
      };
    });
  }

  private async callGPT<T>({
    prompt, content, field, max_completion_tokens,
  }: CallGptDto): Promise<T[] | undefined> {
    try {
      const response = await this.clinet.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: prompt },
          ...(content ? [{ role: 'user' as const, content }] : []),
        ],
        response_format: {
          type: 'json_object',
        },
        ...(max_completion_tokens && { max_completion_tokens }),
      });

      const result = response.choices[0].message?.content?.trim();

      if (!result) {
        return undefined;
      }

      const parsedContent = JSON.parse(result);

      if (
        parsedContent
      && typeof parsedContent === 'object'
      && Array.isArray(parsedContent[field])
      ) {
        return parsedContent[field];
      }

      logger.warn(AppErrorName.CHATGPT_UNEXPECTED_RESPONSE_FORMAT, {
        content: result,
      });

      return undefined;
    } catch (err) {
      const errorName = AppErrorName.CHATGPT_GENERATION_ERROR;

      logger.error(errorName, err);

      throw new AppException(
        errorName,
        { status: HttpStatus.BAD_REQUEST, cause: err },
      );
    }
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
