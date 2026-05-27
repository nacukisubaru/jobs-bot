import { hours, minutes } from '../utils/common';

export const HH_URL = 'https://hh.ru';

export const MAX_RETRY_JOB_APPLICATION_RUN_COUNT = 5;

export const SEEN_VACANCIES_KEY = 'seen_vacancies';
export const SEEN_VACANCIES_TTL = 60 * 60 * 24 * 30; // 30 дней

export const TG_CHAT_ID = Number(process.env.TG_BOT_CHAT_ID);

export const PAGE_PARSING_DELAY = Number(process.env.PAGE_PARSING_DELAY) || 5000;

export const CRON = {
  CHECK_AUTH: '0 8-23 * * *', // каждый час в :00, с 08:00 до 23:00
  CHATTING: '*/10 8-23 * * *', // каждые 10 минут с 08:00 до 23:00
  VACANCIES_REPLIES: '20 8-23 * * *', // каждый час в :20, с 08:00 до 23:00
  SAVED_VACANCIES: '40 8-23 * * *', // каждый час в :40, с 08:00 до 23:00
  PREPARE_VACANCIES: '0 0-7 * * *', // в 01:00, 03:00, 05:00, 07:00
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
