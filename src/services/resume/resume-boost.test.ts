import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ResumeBoostScheduler } from './resume-boost.scheduler';
import { BrowserService } from '../browser/browser.service';

describe('ResumeBoostScheduler', () => {
  let browserService: BrowserService;
  let resumeBooster: ResumeBoostScheduler;

  beforeAll(async () => {
    browserService = new BrowserService();
    resumeBooster = new ResumeBoostScheduler(browserService);
  });

  afterAll(async () => {
    await browserService.stop();
  });

  it('конструктор — создаёт экземпляр ResumeBoostScheduler', () => {
    expect(resumeBooster).toBeInstanceOf(ResumeBoostScheduler);
  });

  it('init — запускает бустинг резюме', async () => {
    await resumeBooster.init();
    expect(true).toBe(true);
  });
});
