import { IAIProvider, CallAIDto, FormsAnswers } from './providers/ai-provider.types';
import { AIProvider } from './providers/ai.provider';

import { IAiService } from './ai.types';
import { Resume } from '../resume/resume.types';

import { FormQuestion, Reply, Vacancy } from '../vacancy/vacancy.types';

import {
  AI_ASK_FORM_QUESTION_PROMPT,
  AI_CHOISE_RESUME_FOR_APPLYING_PROMPT,
  AI_LETTER_PROMPT,
  AI_REPLY_TO_CHAT,
} from '../../common/constants/ai';
import { SettingsModel } from '../../models/settings/settings.model';
import { format } from '../../common/utils/format';
import { truncateText } from '../../common/utils/common';

export class AIService implements IAiService {
  private provider: IAIProvider;

  constructor(provider?: IAIProvider) {
    this.provider = provider ?? new AIProvider(
      process.env.DEEPSEEK_API_KEY!,
      'https://api.deepseek.com/v1',
      'deepseek-chat',
    );
  }

  async call<T>(dto: CallAIDto & { field: string }): Promise<T>;
  async call(dto: CallAIDto & { field?: undefined }): Promise<string>;
  async call<T>({
    prompt, content, field, max_completion_tokens,
  }: CallAIDto): Promise<T | string> {
    return this.provider.call({
      prompt, content, field, max_completion_tokens,
    } as any);
  }

  async generateLetter(vacancy: Vacancy): Promise<string> {
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const vacText = `
      Название: ${vacancy.title} 
      Компания: ${vacancy.company || 'Не указано'}
      Описание: ${truncateText(vacancy.description as string, 1000)}\n
    `;

    const { personInfo } = careerSettings.value;

    return this.provider.call({ prompt: format(AI_LETTER_PROMPT, { ...personInfo }), content: vacText });
  }

  async generateVacancyFormAnswers(form: FormQuestion[]): Promise<FormsAnswers> {
    const prompt = format(AI_ASK_FORM_QUESTION_PROMPT, { form: JSON.stringify(form) });

    return this.provider.call({ prompt, field: 'form' });
  }

  async generateChatReply(message: string): Promise<Reply> {
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const { personInfo } = careerSettings.value;

    const prompt = format(AI_REPLY_TO_CHAT, {
      message,
      ...personInfo,
    });

    return this.provider.call({ prompt, field: 'reply' });
  }

  async generateResumeSelection(vacancyName: string, resumesList: string[]): Promise<string[]> {
    return this.provider.call({
      prompt: format(AI_CHOISE_RESUME_FOR_APPLYING_PROMPT, { vacancyName, resumesList: resumesList.join(',') }),
      field: 'resumes',
    });
  }

  async generateResumes(): Promise<Resume[]> {
    const resumeSettings = await SettingsModel.getByKey('resume');
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    if (!resumeSettings?.value) {
      return [];
    }

    const { resumeExamples, experiencePeriods } = resumeSettings.value;

    if (!resumeExamples || !experiencePeriods) {
      return [];
    }

    const { specializations, contacts } = careerSettings?.value || {};

    if (!specializations?.length || !contacts) {
      return [];
    }

    const specializationsText = specializations
      .map((spec: any) => `id: ${spec.id}, специализация: ${spec.name}`)
      .join('\n\n');

    const generatedResumes: Resume[] = await this.provider.call({
      prompt: `Сгенерируй резюме по специальностям:\n${specializationsText}\nКонтакты: ${contacts}`,
      field: 'resumes',
      max_completion_tokens: 10000,
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
}
