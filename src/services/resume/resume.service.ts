import { BrowserContext, Page } from 'playwright';

import { IResumeService, Resume } from './resume.types';

import { HH_URL, TG_CHAT_ID } from '../../common/constants/common';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';
import { bot } from '../../bot/bot';
import { BotMessageName } from '../../common/constants/bot';
import { GPTService } from '../chatgpt/chatgpt.service';
import { Experience, GeneratedResume } from '../chatgpt/chatgpt.types';

type CreateResumeDto = GeneratedResume;

export class ResumeService implements IResumeService {
  constructor(
    private browserContext: BrowserContext,
    private gptService: GPTService,
  ) {}

  async getResumes(): Promise<Resume[]> {
    const page: Page = await this.browserContext.newPage();

    const resumes: Resume[] = [];

    try {
      await page.goto(`${HH_URL}/applicant/resumes`, { waitUntil: 'domcontentloaded' });

      const resumesMeta = await page.$$eval(
        '[data-qa^="resume-card-link-"]',
        (els) => els
          .map((el) => ({
            link: el.getAttribute('href'),
            title: el
              .querySelector('[data-qa="resume-title"]')
              ?.textContent?.trim(),
          }))
          .filter((r): r is { link: string, title: string } => Boolean(r.link && r.title)),
      );

      if (resumesMeta.length === 0) {
        logger.error(AppErrorName.RESUME_EMPTY_RESUMES_META_ARRAY, new Error(AppErrorName.RESUME_PARSE_ERROR));

        return [];
      }

      for (const resume of resumesMeta) {
        try {
          const content = await this.getResumeDetails(resume.link);

          resumes.push({
            title: resume.title,
            content,
          });
        } catch (err) {
          logger.error(AppErrorName.RESUME_PARSE_ERROR, err);

          continue;
        }
      }
    } catch (err) {
      logger.error(AppErrorName.RESUME_PARSE_ERROR, err);
    } finally {
      await page.close();
    }

    if (!resumes.length) {
      logger.warn(new Error(AppErrorName.JOB_APPLICATION_RESUMES_EMPTY_ERROR));

      bot.sendMessage(TG_CHAT_ID, BotMessageName.RESUMES_PARSING_ERROR);
    }

    return resumes;
  }

  async createResumes(): Promise<void> {
    const generatedResumes = await this.gptService.generateResumes();

    for (const resume of generatedResumes) {
      await this.createResume(resume);
    }
  }

  private async getResumeDetails(link: string): Promise<string> {
    const page: Page = await this.browserContext.newPage();

    let experienceText = '';

    try {
      await page.goto(`${HH_URL}${link}`, { waitUntil: 'domcontentloaded' });

      experienceText = await page.$$eval(
        '[data-qa="resume-list-card-experience"]',
        (blocks) => blocks.map((b) => b.textContent?.trim()).join('\n\n'),
      );

      if (!experienceText) {
        throw new AppException(
          AppErrorName.RESUME_PARSE_ERROR,
          { status: HttpStatus.BAD_REQUEST, cause: 'EMPTY_CONTENT_IN_RESUME_DETAILS' },
        );
      }
    } catch (err) {
      throw new AppException(
        AppErrorName.RESUME_PARSE_ERROR,
        { status: HttpStatus.BAD_REQUEST, cause: err },
      );
    } finally {
      await page.close();
    }

    return experienceText;
  }

  private async createResume(createResumeDto: CreateResumeDto): Promise<void> {
    const page: Page = await this.browserContext.newPage();

    await page.goto(
      'https://hh.ru/profile/resume/professional_role?hhtmFrom=vacancy&hhtmFromLabel=create_resume_header',
      { waitUntil: 'domcontentloaded' },
    );

    // =========================
    // Выбор профессии
    // =========================
    const selectJob = page.locator('[data-qa="resume-profile-card-select-job"]');

    console.log('selectJob', await selectJob.count());

    await selectJob.waitFor({ state: 'visible' });
    await selectJob.first().scrollIntoViewIfNeeded();
    await selectJob.first().click({ force: true });

    // =========================
    // Ввод профессии
    // =========================
    const professionInput = page.locator('[data-qa="resume-profile-position-input"]');

    await professionInput.waitFor({ state: 'visible' });
    await professionInput.click();
    await professionInput.fill(createResumeDto.profession);

    await page.keyboard.press('Escape');
    await professionInput.blur();

    // =========================
    // Next screen
    // =========================
    const nextScreen = page.locator('[data-qa="resume-profile-next-screen"]');

    await nextScreen.waitFor({ state: 'visible' });
    await nextScreen.click({ force: true });

    // =========================
    // Проверка модалки IT
    // =========================
    const modalHeader = page.locator('[data-qa="modal-header-image"]');

    if (await modalHeader.isVisible().catch(() => false)) {
      const itCategory = page.locator(
        'span[data-qa="cell-text-content"]:has-text("Информационные технологии")',
      );

      await itCategory.waitFor({ state: 'visible' });
      await itCategory.first().click();

      const developer = page.locator(
        'span[data-qa="cell-text-content"]:has-text("Программист, разработчик")',
      );

      const scrollContainer = page.locator('[data-qa="tree-selector-container"]');

      // скроллим пока не появится элемент
      for (let i = 0; i < 20; i++) {
        if (await developer.isVisible().catch(() => false)) break;

        await scrollContainer.evaluate((el) => {
          el.scrollTop += 500;
        });

        await page.waitForTimeout(300);
      }

      await developer.waitFor({ timeout: 15000 });
      await developer.first().click();

      // =========================
      // Primary actions
      // =========================
      const primaryActions = page.locator('[data-qa="primary-actions"]');

      await primaryActions.waitFor({ state: 'visible' });
      await primaryActions.click({ force: true });
    }

    // =========================
    // Next screen
    // =========================

    await nextScreen.waitFor({ state: 'visible' });
    await nextScreen.click({ force: true });

    const hasProfileForm = page.locator(
      'input[data-qa="resume-profile-common-surname-input"]',
    );

    await hasProfileForm.waitFor({ state: 'visible', timeout: 15000 });

    await nextScreen.click({ force: true });

    await page.locator('h1[data-qa="title"]').waitFor({ state: 'visible' });

    const nextScreen22 = page.locator('[data-qa="resume-profile-next-screen"]');

    await nextScreen22.waitFor({ state: 'visible' });
    await nextScreen22.scrollIntoViewIfNeeded();
    await nextScreen22.click();

    // =========================
    // Skills step
    // =========================
    const chipsInput = page.locator('[data-qa="chips-trigger-input"]');

    await chipsInput.waitFor({ state: 'visible' });

    for (const keyword of createResumeDto.keywords) {
      await chipsInput.click();
      await chipsInput.fill(keyword);

      const suggestion = page
        .locator('[data-qa="suggest-item-chips"]')
        .first();

      await suggestion.waitFor({ state: 'visible' });
      await suggestion.click();
    }

    await nextScreen.click({ force: true });

    // =========================
    // Skill levels
    // =========================
    const skillLevels = page.locator('[data-qa^="skill-level-"]');

    await skillLevels.first().waitFor({ state: 'visible' });

    const count = await skillLevels.count();

    for (let i = 0; i < count; i++) {
      await skillLevels.nth(i).click({ force: true });
    }

    // =========================
    // Next screen
    // =========================
    await nextScreen.click({ force: true });

    const { experience } = createResumeDto;

    await page.getByText('Работаю сейчас', { exact: true }).click();

    // =========================
    // FIRST (base form)
    // =========================
    await ResumeService.fillExperienceForm(page, experience[0], 0);

    // =========================
    // MODAL LOOP
    // =========================
    for (let i = 1; i < experience.length; i++) {
      const exp = experience[i];

      await page.locator('[data-qa="list-add"]').first().click();

      await page
        .locator(
          `[data-qa="resume-profile-experience-specific-company-input-${i}"]`,
        )
        .waitFor({ state: 'visible' });

      await page.getByText('Работаю сейчас', { exact: true }).click();

      await ResumeService.fillExperienceForm(page, exp, i);

      await page.locator('[data-qa="primary-actions"]').click();
    }

    await nextScreen.waitFor({ state: 'visible' });
    await nextScreen.scrollIntoViewIfNeeded();
    await nextScreen.click();
  }

  private static async fillExperienceForm(page: Page, exp: Experience, index = 0) {
    const [start, end] = exp.periods ?? [];

    // =========================
    // START DATE - MONTH
    // =========================
    await page
      .locator(
        `[data-qa="resume-profile-experience-specific-datestart-month-input-${index}"]`,
      )
      .click();

    await page.waitForTimeout(150);

    await page
      .locator(
        `[data-qa="magritte-select-option-${String(start.month).padStart(2, '0')}"]`,
      )
      .filter({ visible: true })
      .first()
      .click();

    await page.waitForTimeout(150);

    // =========================
    // START YEAR
    // =========================
    await page
      .locator(
        `[data-qa="resume-profile-experience-specific-datestart-year-input-${index}"]`,
      )
      .fill(String(start.year));

    // =========================
    // END MONTH
    // =========================
    await page
      .locator(
        `[data-qa="resume-profile-experience-specific-dateend-month-input-${index}"]`,
      )
      .click();

    await page.waitForTimeout(150);

    await page
      .locator(
        `[data-qa="magritte-select-option-${String(end.month).padStart(2, '0')}"]`,
      )
      .filter({ visible: true })
      .first()
      .click();

    await page.waitForTimeout(150);

    // =========================
    // END YEAR
    // =========================
    await page
      .locator(
        `[data-qa="resume-profile-experience-specific-dateend-year-input-${index}"]`,
      )
      .fill(String(end.year));

    // =========================
    // TEXT FIELDS
    // =========================
    await page
      .locator(
        `[data-qa="resume-profile-experience-specific-company-input-${index}"]`,
      )
      .fill(exp.company ?? '');

    await page
      .locator(
        `[data-qa="resume-profile-experience-specific-position-input-${index}"]`,
      )
      .fill(exp.position ?? '');

    await page
      .locator(
        `[data-qa="resume-profile-experience-specific-responsibilities-input-${index}"]`,
      )
      .fill(exp.description ?? '');
  }
}
