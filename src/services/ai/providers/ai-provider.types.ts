export interface CallAIDto {
  prompt: string;
  content?: string;
  field?: string;
  max_completion_tokens?: number;
}

export interface IAIProvider {
  call<T>(dto: CallAIDto & { field: string }): Promise<T>;
  call(dto: CallAIDto & { field?: undefined }): Promise<string>;
}

export interface FormsAnswers {
  inputs: { id: string, value: string }[],
  options: string[]
}
