import OpenAI from 'openai';

import { Reply, Vacancy } from '../vacancy/vacancy.types';
import { Resume } from '../resume/resume.types';

import {
  CallGptDto, GeneratedVacancyApplication, IGPTService,
} from './chatgpt.types';

import {
  CHATGPT_ANALYZE_VACANCIES_PATTERNS,
  CHATGPT_ASK_FORM_QUESTION_PROMPT,
  CHATGPT_CREATE_RESUMES_PROMPT,
  CHATGPT_MAX_VACANCY_PROMPT_TOKENS,
  CHATGPT_REPLY_TO_CHAT,
  CHATGPT_VACANCY_FILTER_PROMPT,
} from '../../common/constants/chatgpt';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';
import { SettingsModel } from '../../models/settings/settings.model';
import { format } from '../../common/utils/format';
import { PromptBuilder } from '../../common/utils/prompt-builder';

import { VacancyApplicationModel } from '../vacancy-application/vacancy-applications.model';

import { SpecializationSetting } from '../../models/settings/settings.types';

export class GPTService implements IGPTService {
  private clinet: OpenAI;

  constructor() {
    this.clinet = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateVacancyApplications(
    vacancies: Vacancy[],
    specialization: SpecializationSetting,
    keywords: string,
  ): Promise<GeneratedVacancyApplication[]> {
    const vacancyApplications: GeneratedVacancyApplication[] = [];

    if (!vacancies.length) {
      return [];
    }

    const prompt = new PromptBuilder();

    const chunks: string[] = await GPTService.prepareVacancyChunks(vacancies);

    prompt.add('Фильтр', format(CHATGPT_VACANCY_FILTER_PROMPT, {
      specialization: specialization.name,
      ...(keywords && { keywords }),
    }));

    if (vacancies.find((vac) => vac.form)) {
      prompt.add('Формы', CHATGPT_ASK_FORM_QUESTION_PROMPT);
    }

    for (const chunk of chunks) {
      const vacancyApplicationsResponse = await this.callGPT<GeneratedVacancyApplication[]>({
        prompt: prompt.build(),
        content: chunk,
        field: 'vacancies',
      });

      if (vacancyApplicationsResponse) {
        vacancyApplications.push(...vacancyApplicationsResponse);
      }
    }

    return vacancyApplications;
  }

  async generateResumes(): Promise<Resume[]> {
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
    const specializationsText = specializations.map((spec: SpecializationSetting) => `id: ${spec.id}, специализация: ${spec.name}`).join('\n\n');

    const patternsText = await this.analyzeInterviewPatterns();

    const prompt = format(
      CHATGPT_CREATE_RESUMES_PROMPT,
      {
        specializations: specializationsText,
        companies: companiesText,
        resumeExamples: experienceText,
        contacts,
        experienceCount: resumeExamples.length,
        resumesCount: specializations.length,
        patternsText,
      },
    );

    const generatedResumes: Resume[] = await this.callGPT({
      prompt, field: 'resumes', max_completion_tokens: 10000,
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

  async analyzeInterviewPatterns(): Promise<string> {
    const vacancies = await VacancyApplicationModel.getRecentInterviews();

    if (!vacancies.length) return '';

    const vacanciesText = vacancies.length
      ? vacancies.map((v) => v.description).join('\n\n')
      : '';

    const prompt = format(CHATGPT_ANALYZE_VACANCIES_PATTERNS, {
      vacancies: vacanciesText,
    });

    return this.callGPT({ prompt });
  }

  async generateChatReply(message: string): Promise<Reply> {
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const { fio, contacts, salary } = careerSettings.value;

    const prompt = format(CHATGPT_REPLY_TO_CHAT, {
      message,
      fio,
      contacts,
      salary,
    });

    return this.callGPT({ prompt, field: 'reply' });
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

  private async callGPT<T>(dto: CallGptDto & { field: string }): Promise<T>;
  private async callGPT(dto: CallGptDto & { field?: undefined }): Promise<string>;
  private async callGPT<T>({
    prompt, content, field, max_completion_tokens,
  }: CallGptDto): Promise<T | string> {
    try {
      const response = await this.clinet.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: prompt },
          ...(content ? [{ role: 'user' as const, content }] : []),
        ],
        ...(field && { response_format: { type: 'json_object' } }),
        ...(max_completion_tokens && { max_completion_tokens }),
      });

      const result = response.choices[0].message?.content?.trim();

      if (!result) {
        throw new AppException(AppErrorName.CHATGPT_RESPONSE_EMPTY);
      }

      if (!field) return result;

      const parsedContent = JSON.parse(result);

      if (parsedContent && typeof parsedContent === 'object') {
        return parsedContent[field];
      }

      throw new AppException(AppErrorName.CHATGPT_UNEXPECTED_RESPONSE_FORMAT);
    } catch (err) {
      const errorName = AppErrorName.CHATGPT_GENERATION_ERROR;

      logger.error(errorName, err);

      throw new AppException(errorName, { status: HttpStatus.BAD_REQUEST, cause: err });
    }
  }
}
