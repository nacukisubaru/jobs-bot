import path from 'path';
import fs from 'fs/promises';

import { Page } from 'playwright';

export async function sleep(delay: number) {
  return new Promise((r) => { setTimeout(r, delay); });
}

export const hours = (h: number) => h * 60 * 60 * 1000;
export const minutes = (m: number) => m * 60 * 1000;
export const seconds = (s: number) => s * 1000;

export async function debugScreenshot(page: Page, label: string): Promise<void> {
  try {
    if (page.isClosed()) return;

    await fs.mkdir('debug-screenshots', { recursive: true });

    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${label}_${random}.png`;
    const filepath = path.join('debug-screenshots', filename);

    await page.screenshot({ path: filepath, fullPage: true });
  } catch (error: any) {
    console.warn(`[debugScreenshot] failed: ${error.message}`);
  }
}

export function truncateText(text: string, limit = 500) {
  if (text.length <= limit || !text) return text;

  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

export function hasContactPattern(text: string): boolean {
  const textWithoutUrls = text.replace(/https?:\/\/\S+/g, '');

  return /(@\w+|(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|[\w.-]+@[\w.-]+\.\w+)/i.test(
    textWithoutUrls,
  );
}

export function parseTime(text: string): string | null {
  const TIME_PATTERN = /\b(\d{1,2}:\d{2})\b/;

  return text.match(TIME_PATTERN)?.[1] ?? null;
}

export function timeToCron(time: string): string {
  const [hours, minutes] = time.split(':');

  return `${minutes} ${hours} * * *`;
}
