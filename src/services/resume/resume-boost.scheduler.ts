import { BrowserContext, Page } from 'playwright';

import { createScheduledTask } from '../scheduler/scheduler-factory';
import { AsyncScheduler } from '../scheduler/scheduler.service';

import { parseTime, timeToCron } from '../../common/utils/common';

export class ResumeBoostScheduler {
  private jobs: AsyncScheduler[] = [];

  private page: Page | null = null;

  constructor(private readonly browserContext: BrowserContext) {}

  async init(): Promise<void> {
    this.page = await this.browserContext.newPage();

    await this.page.goto('https://hh.ru/applicant/resumes', { waitUntil: 'domcontentloaded' });

    try {
      const updateButtons = this.page.locator('[data-qa="resume-update-button-text"]');
      const hasUpdateButtons = (await updateButtons.count()) > 0;

      if (hasUpdateButtons) {
        await this.clickAvailableUpdateButtons();
      }

      const times = await this.parseRenewalTimes();
      const allTimes = [...new Set(times)];

      if (allTimes.length === 0) {
        console.warn('Нет ни кнопок, ни renewal-текстовок — нечего планировать');
        return;
      }

      this.scheduleByTimes(allTimes);
    } finally {
      await this.page.close();
      this.page = null;
    }
  }

  private async clickAvailableUpdateButtons(): Promise<void> {
    if (!this.page) return;

    const buttons = this.page.locator('[data-qa="resume-update-button-text"]');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
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

  private scheduleByTimes(times: string[]): void {
    this.clearJobs();

    const uniqueTimes = [...new Set(times)];

    const alreadyScheduled = new Set(this.jobs.map((job) => job.getCronExpression()));
    const newTimes = uniqueTimes.filter((time) => !alreadyScheduled.has(timeToCron(time)));

    if (newTimes.length === 0) {
      console.log('Все времена уже запланированы, пропускаем');

      return;
    }

    this.jobs = uniqueTimes.map((time) => createScheduledTask(
      () => this.init(),
      timeToCron(time),
      5000,
      3,
      `Ошибка поднятия резюме в ${time}`,
      `Не удалось поднять резюме в ${time}`,
    ));

    console.log(`Запланировано ${this.jobs.length} job(s): ${uniqueTimes.join(', ')}`);
  }

  private clearJobs(): void {
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
  }
}
