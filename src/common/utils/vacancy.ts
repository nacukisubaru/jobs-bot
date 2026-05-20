// utils/clickVacancyResponseButton.ts

import { Page } from 'playwright';

import { AppException } from '../exceptions';

const APPLY_BUTTON_SELECTORS = [
  '[data-qa^="vacancy-response-link-top"]',
  '[data-qa="vacancy-response-link-top-again"]',
] as const;

const VISIBLE_TIMEOUT = 90_000;
const CLICK_DELAY = 2_000;

export const clickVacancyApplyButton = async (page: Page): Promise<void> => {
  for (const selector of APPLY_BUTTON_SELECTORS) {
    try {
      const button = page.locator(selector).first();

      await button.waitFor({ state: 'visible', timeout: VISIBLE_TIMEOUT });

      await page.waitForTimeout(CLICK_DELAY);
      await button.click();

      return;
    } catch (e) {
      console.warn(`[clickVacancyApplyButton] selector "${selector}" failed:`, e);
    }
  }

  console.error('[clickVacancyApplyButton] all selectors exhausted, throwing');
  throw new AppException('VACANCY_APPLICATION_APPLY_BTN_NOT_FOUND');
};
