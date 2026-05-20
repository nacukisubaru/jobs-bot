import { Page } from 'playwright';

import { debugScreenshot, parseTime } from '../../common/utils/common';
import { BrowserService } from '../browser/browser.service';
import { appContainer } from '../../app-container';
import { closeModalIfExists } from '../../common/utils/playwright';

export class ResumeBoostScheduler {
  private page: Page | null = null;

  constructor(private readonly browserService: BrowserService) {}

  async init(): Promise<void> {
    await this.browserService.start();

    this.page = await this.browserService.getContext().newPage();

    await this.page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded' });

    try {
      await closeModalIfExists(this.page);

      const updateButtons = this.page.locator('[data-qa="resume-update-button-text"]');
      const hasUpdateButtons = (await updateButtons.count()) > 0;

      await debugScreenshot(this.page, 'resume_booster_1');

      if (hasUpdateButtons) {
        await this.clickAvailableUpdateButtons();

        await debugScreenshot(this.page, 'resume_booster_2');
      }

      const times = await this.parseRenewalTimes();
      const allTimes = [...new Set(times)];

      if (allTimes.length === 0) {
        console.warn('Нет ни кнопок, ни renewal-текстовок — нечего планировать');
        return;
      }
      const uniqueTimes = [...new Set(allTimes)];

      appContainer.scheduler.scheduleByTimes(uniqueTimes, 'resumebooster_');
    } catch {
      await debugScreenshot(this.page, 'resume_booster_init_error');
    } finally {
      await this.page.close();
      await this.browserService.stop();

      this.page = null;
    }
  }

  private async clickAvailableUpdateButtons(): Promise<void> {
    if (!this.page) return;

    const buttons = this.page.locator('[data-qa="resume-update-button-text"]');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);

      await button.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(300);
      await button.click();
      await this.page.waitForTimeout(500);
    }
  }

  private async parseRenewalTimes(): Promise<string[]> {
    if (!this.page) return [];

    const renewalLocator = this.page.locator('[data-qa="resume-renewal-manual-text"]');
    const count = await renewalLocator.count();

    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await renewalLocator.nth(i).textContent();

      if (text) texts.push(text);
    }

    return texts
      .map(parseTime)
      .filter((t): t is string => !!t);
  }
}
