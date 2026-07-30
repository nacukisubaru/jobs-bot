import OpenAI from 'openai';

import { IAIProvider, CallAIDto } from './ai-provider.types';

import { AppException } from '../../../common/exceptions';
import { AppErrorName } from '../../../common/constants/errors';
import { HttpStatus } from '../../../common/constants/https-status';
import { logger } from '../../../common/logger';

export class AIProvider implements IAIProvider {
  private client: OpenAI;

  private model: string;

  constructor(
    apiKey: string,
    baseURL: string,
    model: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  async call<T>(dto: CallAIDto & { field: string }): Promise<T>;
  async call(dto: CallAIDto & { field?: undefined }): Promise<string>;
  async call<T>({
    prompt, content, field, max_completion_tokens,
  }: CallAIDto): Promise<T | string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
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
}
