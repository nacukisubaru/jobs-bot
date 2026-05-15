import { hours, minutes } from '../utils/common';

export const HH_URL = 'https://hh.ru';

export const EXECUTABLE_BROWSER_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const MAX_RETRY_JOB_APPLICATION_RUN_COUNT = 5;

export const SEEN_VACANCIES_KEY = 'seen_vacancies';
export const SEEN_VACANCIES_TTL = 60 * 60 * 24 * 30; // 30 дней

export const TG_CHAT_ID = Number(process.env.TG_BOT_CHAT_ID);

export const PAGE_PARSING_DELAY = Number(process.env.PAGE_PARSING_DELAY) || 5000;

export const CRON = {
  EVERY_HOUR: '0 * * * *',
  EVERY_3_HOURS: '0 */3 * * *',
  EVERY_4_HOURS: '0 */4 * * *',
  EVERY_MONDAY_AT_9: '0 9 * * 1',
} as const;

export const AUTO_REPLIES_DELAY = process.env.AUTO_REPLIES_DELAY
  ? minutes(Number(process.env.AUTO_REPLIES_DELAY))
  : hours(1);

export const AUTO_REPLIES_RETRY_DELAY = process.env.AUTO_REPLIES_RETRY_DELAY
  ? minutes(Number(process.env.AUTO_REPLIES_RETRY_DELAY))
  : minutes(10);

export const AUTO_REPLIES_REPEAT_DELAY = process.env.AUTO_REPLIES_REPEAT_DELAY
  ? hours(Number(process.env.AUTO_REPLIES_REPEAT_DELAY))
  : hours(2);

export const AUTO_REPLIES_RETRY_REPEAT_DELAY = process.env.AUTO_REPLIES_RETRY_REPEAT_DELAY
  ? minutes(Number(process.env.AUTO_REPLIES_RETRY_REPEAT_DELAY))
  : minutes(20);

export const AUTO_REPLY_INTERVAL_HOURS = process.env.AUTO_REPLIES_REPEAT_DELAY
  ? hours(Number(process.env.AUTO_REPLIES_REPEAT_DELAY))
  : hours(96);
