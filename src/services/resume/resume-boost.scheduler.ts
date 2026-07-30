import { Page } from 'playwright';

import { debugScreenshot } from '../../common/utils/common';
import { BrowserService } from '../browser/browser.service';
import { closeModalIfExists } from '../../common/utils/playwright';

export class ResumeBoostScheduler {
  private page: Page | null = null;

  constructor(
    private readonly browserService: BrowserService,
  ) {}

  async init(): Promise<void> {
    await this.browserService.start();

    this.page = await this.browserService.getContext().newPage();

    await this.page.addInitScript(() => {
      new MutationObserver(() => {
        const overlay = document.querySelector('[data-qa="modal-overlay"]');

        if (overlay) (overlay as HTMLElement).click();
      }).observe(document.body, { childList: true, subtree: true });
    });

    await this.page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded' });

    try {
      const updateButtons = this.page.locator('[data-qa="resume-update-button-text"]');
      const hasUpdateButtons = (await updateButtons.count()) > 0;

      if (hasUpdateButtons) {
        await this.clickAvailableUpdateButtons();
      }
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

      await closeModalIfExists(this.page);
    }
  }
}
