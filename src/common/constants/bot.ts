export const enum BotMessageName {
  // success
  AUTO_REPLIES_RUN = '🚀 Запускаю автоотклики',
  AUTO_REPLIES_SUCCESS_DONE = 'Автоотклики успешно завершены!',
  CHECKING_AUTORIZE = 'Проверяю авторизацию...',
  AUTHORIZATION_SUCCESS = '✅ Авторизация успешна',

  // failure
  CHATGPT_FILTER_FAILED = 'Чат гпт не отфильтровал вакансии!',
  VACANCY_PARSING_ERROR = 'Вакансии не парсятся!',
  GET_JOBS_ERROR = 'Ошибка получения вакансий!',
  AUTO_REPLIES_RUN_ERROR = '❌ Ошибка при запуске автокликов:',
  AUTHORIZATION_ERROR = '❌ Вы не авторизованы. Загрузите профиль по ссылке',
  RESUMES_PARSING_ERROR = 'Резюмехи не парсятся!',
  AUTO_REPLIES_IS_STOPPED = 'Автоотклики остановлены!',
  AUTO_REPLIES_IS_RUNNING_WAIT = 'Автоотклики уже запущены, после выполнения процесс будет остановлен',
  AUTO_REPLIES_FAILED = 'Ошибка автооткликов, повторная попытка через 30 мин',

  // warnings
  AUTHORIZATION_IS_EXPIRED = '⚠️ Авторизация истекла. Загрузите профиль заново',
  CAPTCHA_DETECTED = 'При парсинге hh.ru выкидывает капчу, просьба пройти, чтобы мы могли продолжить...',
}
