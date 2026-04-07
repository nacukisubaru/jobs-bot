export const HH_URL = 'https://hh.ru';
export const PROFILE_PATH = './hh-profile';

export const MAX_RETRY_JOB_APPLICATION_RUN_COUNT = 5;

export const TG_CHAT_ID = Number(process.env.TG_BOT_CHAT_ID);

export const PAGE_PARSING_DELAY = Number(process.env.PAGE_PARSING_DELAY) || 5000;
export const AUTO_REPLIES_DELAY = Number(process.env.AUTO_REPLIES_DELAY) || 60 * 60 * 1000;
export const AUTO_REPLIES_RETRY_DELAY = Number(process.env.AUTO_REPLIES_RETRY_DELAY) || 10 * 60 * 1000;
