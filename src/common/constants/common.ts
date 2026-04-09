import { hours, minutes } from '../utils/common';

export const HH_URL = 'https://hh.ru';
export const PROFILE_PATH = './hh-profile';

export const MAX_RETRY_JOB_APPLICATION_RUN_COUNT = 5;

export const TG_CHAT_ID = Number(process.env.TG_BOT_CHAT_ID);

export const PAGE_PARSING_DELAY = Number(process.env.PAGE_PARSING_DELAY) || 5000;

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
