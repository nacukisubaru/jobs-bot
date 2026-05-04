export enum AppErrorName {
  VACANCY_MISSING_NEXT_BUTTON = 'vacancy_missing_next_btn',
  VACANCY_PARSE_ERROR = 'vacancy_parse_error',

  RESUME_PARSE_ERROR = 'resume_parse_error',
  RESUME_EMPTY_RESUMES_META_ARRAY = 'resume_empty_resumes_meta_array',
  RESUME_SETTINGS_NOT_FOUND = 'resume_settings_not_found',
  RESUME_SETTINGS_INCOMPLETE = 'resume_settings_incomplete',

  CHATGPT_GENERATION_ERROR = 'chatgpt_generation_error',
  CHATGPT_UNEXPECTED_RESPONSE_FORMAT = 'chatgpt_unexpected_response_format',
  CHATGPT_RESPONSE_EMPTY = 'chatgpt_response_empty',

  JOB_APPLICATION_VACANCIES_EMPTY_ERROR = 'job_application_vacancies_empty_error',
  JOB_APPLICATION_RESUMES_EMPTY_ERROR = 'job_application_vacancies_empty_error',
  JOB_APPLICATION_AUTO_APPLY_TO_JOB_ERROR = 'job_application_auto_apply_to_job_error',
  JOB_APPLICATION_VACANCIES_NOT_FILTRED_ERROR = 'job_application_vacancies_not_filtred_error',
  JOB_APPLICATION_APPLY_BTN_NOT_FOUND = 'job_application_apply_btn_not_found',
  JOB_APPLICATION_AUTO_APPLY_FAILED = 'job_application_auto_apply_failed',
  VACANCY_APPLICATIONS_FETCH_ERROR = 'vacancy_applications_fetch_error',

  BROWSER_NETWORK_ERROR = 'browser_network_error',
  BROWSER_CONTEXT_NOT_FOUND = 'browser_context_not_found',
  BROWSER_CAPTCHA_DETECTED_ERROR = 'browser_captcha_detected_error',
  BROWSER_RUN_ERROR = 'browser_run_error',
  BROWSER_AUTHORIZATION_IS_EXPIRED_ERROR = 'browser_authorization_is_expired_error',

  CAREER_SETTINGS_NOT_FOUND = 'career_settings_not_found',
  CAREER_SETTINGS_INCOMPLETE = 'career_settings_incomplete',

  BOT_AUTO_REPLIES_RUN_ERROR = 'bot_auto_replies_run_error',
}
