import { hours, minutes } from '../utils/common';

export const HH_URL = 'https://hh.ru';

export const MAX_RETRY_JOB_APPLICATION_RUN_COUNT = 5;

export const SEEN_VACANCIES_KEY = 'seen_vacancies';
export const SEEN_VACANCIES_TTL = 60 * 60 * 24 * 30; // 30 дней

export const TG_CHAT_ID = Number(process.env.TG_BOT_CHAT_ID);

export const PAGE_PARSING_DELAY = Number(process.env.PAGE_PARSING_DELAY) || 5000;

export const CRON = {
  CHECK_AUTH: '0 * * * *', // каждый час в :00
  CHATTING: '10 * * * *', // каждый час в :10
  VACANCIES_REPLIES: '20 * * * *', // каждый час в :20
  SAVED_VACANCIES: '40 * * * *', // каждый час в :40
  PREPARE_VACANCIES: '0 1,3,5 * * *', // в 01:00, 03:00, 05:00
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
