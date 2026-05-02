import { BrowserContext, Page } from 'playwright';

import { Experience, IResumeService, Resume } from './resume.types';
import { ResumeModel } from './resume.model';

import { GPTService } from '../chatgpt/chatgpt.service';

import { CheckboxToggler } from '../../common/utils/checkbox-toggler';

export class ResumeService implements IResumeService {
  constructor(
    private browserContext: BrowserContext,
    private gptService: GPTService,
  ) {}

  async createResumes(): Promise<void> {
    const generatedResumes = await this.gptService.generateResumes();

    console.dir(generatedResumes, { depth: null, colors: true });

    await ResumeModel.deleteAll();

    for (const resume of generatedResumes) {
      await this.createResume(resume);

      await ResumeModel.createResume(resume);
    }
  }

  private async createResume(createResumeDto: Resume): Promise<void> {
    const page: Page = await this.browserContext.newPage();

    await page.goto(
      'https://hh.ru/profile/resume/professional_role?hhtmFrom=vacancy&hhtmFromLabel=create_resume_header',
      { waitUntil: 'domcontentloaded' },
    );

    // =========================
    // Выбор профессии
    // =========================
    const selectJob = page.locator('[data-qa="resume-profile-card-select-job"]').first();

    await page.waitForLoadState('networkidle');

    await selectJob.waitFor({ state: 'visible' });
    await selectJob.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await selectJob.click();

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
      if (await chipsInput.isDisabled()) break;

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

    // ========================
    // Deactivate checkboxes
    // ========================
    const checkboxToggler = new CheckboxToggler(page, {
      simpleCheckboxSelector: '[data-qa="checkbox-container"]',
      scrollableItemSelector: '[role="listitem"].resume-select-item--hKiKDVW49VsKHyt9',
      scrollableInputSelector: 'input[type="checkbox"]',
      scrollableLabelSelector: 'label.magritte-card___kxw8G_5-0-5',
      scrollButtonSelector: '[data-qa="scrollable-container__scroll-button-right"]',
    });

    await checkboxToggler.deactivateCheckboxes();

    const { experience } = createResumeDto;

    // =========================
    // MODAL LOOP
    // =========================
    for (let i = 0; i < experience.length; i++) {
      const exp = experience[i];

      const addButton = page.locator('[data-qa="list-add"]').first();
      await addButton.waitFor({ state: 'visible' });

      await addButton.scrollIntoViewIfNeeded();
      await addButton.dispatchEvent('click');

      await page.getByText('Работаю сейчас', { exact: true }).click();

      await checkboxToggler.deactivateScrollableCheckboxes();

      await ResumeService.fillExperienceForm(page, exp);

      await page.locator('[data-qa="primary-actions"]').click();
    }

    await nextScreen.waitFor({ state: 'visible' });
    await nextScreen.scrollIntoViewIfNeeded();
    await nextScreen.click();
  }

  private static async fillExperienceForm(page: Page, exp: Experience) {
    const { start, end } = exp.periods ?? [];

    // =========================
    // START DATE - MONTH
    // =========================
    const monthInput = page.locator(
      '[data-qa^="resume-profile-experience-specific-datestart-month-input-"]',
    ).first();

    await monthInput.waitFor({ state: 'visible' });
    await monthInput.click();

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
        '[data-qa^="resume-profile-experience-specific-datestart-year-input-"]',
      )
      .first()
      .fill(String(start.year));

    // =========================
    // END MONTH
    // =========================
    await page
      .locator(
        '[data-qa^="resume-profile-experience-specific-dateend-month-input-"]',
      )
      .first()
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
        '[data-qa^="resume-profile-experience-specific-dateend-year-input-"]',
      )
      .first()
      .fill(String(end.year));

    // =========================
    // TEXT FIELDS
    // =========================
    await page
      .locator(
        '[data-qa^="resume-profile-experience-specific-company-input-"]',
      )
      .first()
      .fill(exp.company ?? '');

    await page
      .locator(
        '[data-qa^="resume-profile-experience-specific-position-input-"]',
      )
      .first()
      .fill(exp.position ?? '');

    await page
      .locator(
        '[data-qa^="resume-profile-experience-specific-responsibilities-input-"]',
      )
      .first()
      .fill(exp.description ?? '');
  }
}
