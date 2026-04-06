import { BrowserContext, Page } from 'playwright';
import { IResumeService, Resume } from './resume.types';
import { HH_URL } from '../../common/constants/common';

export class ResumeService implements IResumeService {
  constructor(private browserContext: BrowserContext) {}

  async getResumes(): Promise<Resume[]> {
    const page: Page = await this.browserContext.newPage();
    // todo стоит try в цикле сделать
    // выбросив ошибку залогировать ее и continue чтобы дальше парсить
    try {
      await page.goto(`${HH_URL}/applicant/resumes`, { waitUntil: 'domcontentloaded' });

      const resumeHandles = await page.$$('[data-qa^="resume-card-link-"]');

      const resumes: Resume[] = [];

      for (const handle of resumeHandles) {
        let title = '';

        const resumeTitle = await handle.$('[data-qa="resume-title"]');

        if (resumeTitle) {
          title = (await resumeTitle.textContent())?.trim() || '';
        }

        const link = await handle.getAttribute('href');

        if (title && link) {
          const content = await this.getResumeDetails(`${HH_URL}${link}`);

          resumes.push({ title, content });
        }
      }

      return resumes;
    } finally {
      await page.close();
    }
  }

  private async getResumeDetails(link: string): Promise<string> {
    const page: Page = await this.browserContext.newPage();

    let experienceText = '';

    try {
      await page.goto(link, { waitUntil: 'domcontentloaded' });

      experienceText = await page.$$eval(
        '[data-qa="resume-list-card-experience"]',
        (blocks) => blocks.map((b) => b.textContent?.trim()).join('\n\n'),
      );
    } catch (err) {
      console.error({ err });
    } finally {
      await page.close();
    }

    return experienceText;
  }
}
