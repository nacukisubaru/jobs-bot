import { BrowserContext, Page } from 'playwright';

import { IGPTService } from '../chatgpt/chatgpt.types';
import { IVacancyFetcher, Vacancy } from '../vacancy/vacancy.types';

export class JobApplicationService {
    constructor(
        private browserContext: BrowserContext,
        private vacancyFetcher: IVacancyFetcher,
        private gptService: IGPTService
    ) {}

    private async applyToJob(link: string, coverLetter: string): Promise<void> {
        const page: Page = await this.browserContext.newPage();

        try {
            await page.goto(link, { waitUntil: 'domcontentloaded' });

            const responseButton = await page.waitForSelector(
                '[data-qa="vacancy-response-link-top"]',
                { timeout: 5000 }
            );

            if (!responseButton) {
                console.log('Кнопка отклика не найдена');
                return;
            }

            await responseButton.click();

            const responseModalButton = await page.waitForSelector('[data-qa="vacancy-response-submit-popup"]', { timeout: 5000 });
            const addCoverLetter = page.locator('[data-qa="add-cover-letter"]').first();

            if (await addCoverLetter.count()) {
                await addCoverLetter.click(); // больше не ждём visibility после клика
            }

            console.log({coverletterbtn: addCoverLetter})

            const vacancyLetterInput = await page.waitForSelector(
                '[data-qa="vacancy-response-popup-form-letter-input"]',
                { timeout: 5000 }
            );
            console.log({input: vacancyLetterInput})
            await vacancyLetterInput.fill(coverLetter);

            //await responseModalButton.click();

            console.log('Отклик отправлен для:', link);
        } catch (err) {
            console.error('Ошибка при попытке отклика:', err);
        } finally {
            //await page.close();
        }
    }

    public async run(): Promise<void> {
        const vacancies: Vacancy[] = await this.vacancyFetcher.getVacancies();

        for (const vacancy of vacancies) {
            const coverLetter = await this.gptService.generateCoverLetter(vacancy);
            console.log({vacancy, coverLetter});
            await this.applyToJob(vacancy.link, coverLetter);
        }
    }
}