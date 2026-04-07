import { BrowserContext, Page } from 'playwright';

import { IResumeService, Resume } from './resume.types';

import { HH_URL } from '../../common/constants/common';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';

export class ResumeService implements IResumeService {
  constructor(private browserContext: BrowserContext) {}

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

    return resumes;
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
}
