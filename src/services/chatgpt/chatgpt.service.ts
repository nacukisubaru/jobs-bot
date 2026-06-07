import OpenAI from 'openai';

import { FormQuestion, Reply, Vacancy } from '../vacancy/vacancy.types';

import {
  CallGptDto, FormsAnswers,
  // GeneratedVacancyApplication,
  IGPTService,
} from './chatgpt.types';

import {
  CHATGPT_ASK_FORM_QUESTION_PROMPT,
  CHATGPT_CHOISE_RESUME_FOR_APPLYING_PROMPT,
  CHATGPT_LETTER_PROMPT,
  // CHATGPT_MAX_VACANCY_PROMPT_TOKENS,
  CHATGPT_REPLY_TO_CHAT,
  // CHATGPT_VACANCY_FILTER_PROMPT,
} from '../../common/constants/chatgpt';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';
import { SettingsModel } from '../../models/settings/settings.model';
import { format } from '../../common/utils/format';
import { truncateText } from '../../common/utils/common';
// import { PromptBuilder } from '../../common/utils/prompt-builder';

export class GPTService implements IGPTService {
  private clinet: OpenAI;

  constructor() {
    this.clinet = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async callGPT<T>(dto: CallGptDto & { field: string }): Promise<T>;
  async callGPT(dto: CallGptDto & { field?: undefined }): Promise<string>;
  async callGPT<T>({
    prompt, content, field, max_completion_tokens,
  }: CallGptDto): Promise<T | string> {
    try {
      const response = await this.clinet.chat.completions.create({
        model: 'gpt-4.1-mini',
        store: true,
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
      console.log({ result });
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

  async generateLetter(vacancy: Vacancy): Promise<string> {
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const vacText = `
      Название: ${vacancy.title} 
      Компания: ${vacancy.company || 'Не указано'}
      Описание: ${truncateText(vacancy.description as string, 1000)}\n
    `;

    const { personInfo } = careerSettings.value;

    return this.callGPT({ prompt: format(CHATGPT_LETTER_PROMPT, { ...personInfo }), content: vacText });
  }

  async generateVacancyFormAnswers(form: FormQuestion[]): Promise<FormsAnswers> {
    const prompt = format(CHATGPT_ASK_FORM_QUESTION_PROMPT, { form: JSON.stringify(form) });

    return this.callGPT({ prompt, field: 'form' });
  }

  async generateChatReply(message: string): Promise<Reply> {
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const { personInfo } = careerSettings.value;

    const prompt = format(CHATGPT_REPLY_TO_CHAT, {
      message,
      ...personInfo,
    });

    return this.callGPT({ prompt, field: 'reply' });
  }

  async generateResumeSelection(vacancyName: string, resumesList: string[]): Promise<string[]> {
    return this.callGPT({
      prompt: format(CHATGPT_CHOISE_RESUME_FOR_APPLYING_PROMPT, { vacancyName, resumesList: resumesList.join(',') }),
      field: 'resumes',
    });
  }

  // async generateVacancyApplications(
  //   vacancies: Vacancy[],
  // ): Promise<GeneratedVacancyApplication[]> {
  //   const vacancyApplications: GeneratedVacancyApplication[] = [];

  //   if (!vacancies.length) {
  //     return [];
  //   }

  //   const prompt = new PromptBuilder();

  //   console.log('go gpt!');

  //   const chunks: string[] = await GPTService.prepareVacancyChunks(vacancies);

  //   if (vacancies.find((vac) => vac.form)) {
  //     prompt.add('Формы', CHATGPT_ASK_FORM_QUESTION_PROMPT);
  //   }

  //   console.log('go prompt gpt!');

  //   for (const chunk of chunks) {
  //     const vacancyApplicationsResponse = await this.callGPT<GeneratedVacancyApplication[]>({
  //       prompt: prompt.build(),
  //       content: chunk,
  //       field: 'vacancies',
  //     });

  //     if (vacancyApplicationsResponse) {
  //       vacancyApplications.push(...vacancyApplicationsResponse);
  //     }
  //   }

  //   return vacancyApplications;
  // }

  // async generateResumes(): Promise<Resume[]> {
  //   const resumeSettings = await SettingsModel.getByKey('resume');
  //   const careerSettings = await SettingsModel.getByKey('career-preferences');

  //   const resumes = await ResumeModel.find({}).lean();

  //   const professions = resumes.map((resume) => resume.profession).join(',');

  //   if (!resumeSettings) {
  //     throw new AppException(AppErrorName.RESUME_SETTINGS_NOT_FOUND, {
  //       status: HttpStatus.NOT_FOUND,
  //     });
  //   }

  //   if (!careerSettings) {
  //     throw new AppException(AppErrorName.CAREER_SETTINGS_NOT_FOUND, {
  //       status: HttpStatus.NOT_FOUND,
  //     });
  //   }

  //   const { resumeExamples, experiencePeriods } = resumeSettings.value;

  //   if (!resumeExamples || !experiencePeriods) {
  //     throw new AppException(AppErrorName.RESUME_SETTINGS_INCOMPLETE, {
  //       status: HttpStatus.BAD_REQUEST,
  //     });
  //   }

  //   const { specializations, contacts } = careerSettings.value;

  //   if (!specializations || !specializations.length || !contacts) {
  //     throw new AppException(AppErrorName.CAREER_SETTINGS_INCOMPLETE, {
  //       status: HttpStatus.BAD_REQUEST,
  //     });
  //   }

  //   const companiesText = resumeExamples.map((example: any) => example.company).join(', ');
  //   const experienceText = resumeExamples.map((example: any) => `Компания: ${example.company}, Описание: ${example.experience}`).join('\n\n');
  //   const specializationsText = specializations.map((spec: SpecializationSetting) => `id: ${spec.id}, специализация: ${spec.name}`).join('\n\n');

  //   const patternsText = await this.analyzeInterviewPatterns();

  //   const prompt = format(
  //     CHATGPT_CREATE_RESUMES_PROMPT,
  //     {
  //       specializations: specializationsText,
  //       companies: companiesText,
  //       resumeExamples: experienceText,
  //       contacts,
  //       experienceCount: resumeExamples.length,
  //       resumesCount: specializations.length,
  //       patternsText,
  //       professions: professions.join(','),
  //     },
  //   );

  //   const generatedResumes: Resume[] = await this.callGPT({
  //     prompt, field: 'resumes', max_completion_tokens: 10000,
  //   });

  //   if (!generatedResumes) {
  //     return [];
  //   }

  //   return generatedResumes.map((resume) => {
  //     const experience = resume.experience.map((exp, index) => ({
  //       ...exp,
  //       periods: experiencePeriods[index] || [],
  //     }));

  //     return {
  //       ...resume,
  //       experience,
  //     };
  //   });
  // }

  // async analyzeInterviewPatterns(): Promise<string> {
  //   const vacancies = await VacancyApplicationModel.getRecentInterviews();

  //   if (!vacancies.length) return '';

  //   const vacanciesText = vacancies.length
  //     ? vacancies.map((v) => v.description).join('\n\n')
  //     : '';

  //   const prompt = format(CHATGPT_ANALYZE_VACANCIES_PATTERNS, {
  //     vacancies: vacanciesText,
  //   });

  //   return this.callGPT({ prompt });
  // }

  // private static async prepareVacancyChunks(vacancies: Vacancy[]): Promise<string[]> {
  //   const chunks: string[] = [];

  //   const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  //   let text = '';

  //   for (let i = 0; i < vacancies.length; i++) {
  //     const vac = vacancies[i];

  //     const vacText = `
  //       [${vac.link || 'ссылка не указана'}]
  //       Название: ${vac.title}
  //       Компания: ${vac.company || 'Не указано'}
  //       Описание: ${vac.description}\n
  //       Форма: ${vac.form ? JSON.stringify(vac.form) : 'Нет формы'}
  //     `;

  //     if (estimateTokens(text + vacText) > CHATGPT_MAX_VACANCY_PROMPT_TOKENS) {
  //       chunks.push(text);

  //       text = vacText;
  //     } else {
  //       text += vacText;
  //     }

  //     if (i === vacancies.length - 1 && text) {
  //       chunks.push(text);
  //     }
  //   }

  //   return chunks;
  // }
}
