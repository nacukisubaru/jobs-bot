import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';

import {
  Browser,
  BrowserContext, Page,
} from 'playwright';

import { chromium } from 'playwright-extra';

import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { bot } from '../../bot/bot';

import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { TG_CHAT_ID } from '../../common/constants/common';
import { BotMessageName } from '../../common/constants/bot';
import { logger } from '../../common/logger';

export class BrowserService {
  private context: BrowserContext | null = null;

  private browser: Browser | null = null;

  public getContext(): BrowserContext {
    return this.context!;
  }

  public async start(): Promise<BrowserContext> {
    if (this.context) return this.context;

    try {
      await BrowserService.cleanPlaywrightProfiles();

      chromium.use(StealthPlugin());

      this.browser = await chromium.launch({
        executablePath: process.env.EXECUTABLE_BROWSER_PATH,
        headless: true,
        args: [
          // Отключение GPU
          '--disable-gpu',

          // no-cache
          '--disable-cache',
          '--disk-cache-size=0',
          '--disable-application-cache',
          '--media-cache-size=0',

          // // Отключение ненужных фич
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-sync',
          '--disable-translate',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-popup-blocking',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-speech-api',

          // // Сеть / рендеринг
          '--no-first-run',
          '--no-default-browser-check',
          '--mute-audio',
          '--hide-scrollbars',
        ],
      });

      this.context = await this.browser.newContext({
        storageState: 'hh-state.json',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1125, height: 900 },
      });

      await this.context.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'media', 'font'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      this.decorateContext();

      return this.context;
    } catch (error) {
      throw new AppException(AppErrorName.BROWSER_RUN_ERROR, { cause: error });
    }
  }

  public async stop(): Promise<void> {
    if (this.context) {
      await this.context.close();

      await BrowserService.cleanPlaywrightProfiles();

      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();

      this.browser = null;
    }
  }

  public async checkAuth(): Promise<void> {
    await this.start();

    if (!this.context) {
      throw new AppException(AppErrorName.BROWSER_CONTEXT_NOT_FOUND);
    }

    const page = await this.context.newPage();

    try {
      await page.goto('https://hh.ru/applicant/resumes', {
        waitUntil: 'domcontentloaded',
      });

      const url = page.url();

      const isCaptcha = url.includes('captcha')
        || (await page.locator('iframe[src*="captcha"]').count()) > 0
        || (await page.locator('input[name*="captcha"]').count()) > 0
        || (await page.locator('input[id*="captcha"]').count()) > 0;

      if (isCaptcha) {
        bot.sendMessage(TG_CHAT_ID, BotMessageName.CAPTCHA_DETECTED);
      }

      const loginBtn = page.locator('a[data-qa="login"]');

      try {
        await loginBtn.waitFor({ state: 'visible', timeout: 15000 });

        bot.sendMessage(TG_CHAT_ID, BotMessageName.AUTHORIZATION_IS_EXPIRED);
      } catch {
        // intentionaly empty
      }
    } finally {
      await page.close();
      await this.stop();
    }
  }

  private decorateContext(): void {
    if (!this.context) {
      throw new AppException(AppErrorName.BROWSER_CONTEXT_NOT_FOUND);
    }

    this.context.on('page', async (page) => {
      const originalGoto = page.goto.bind(page);

      const decoratedGoto = async (
        url: Parameters<Page['goto']>[0],
        options?: Parameters<Page['goto']>[1],
      ) => {
        const RETRY_COUNT = 20;
        const RETRY_DELAY_MS = 3000;

        for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
          try {
            const result = await originalGoto(url, {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
              ...options,
            });

            return result;
          } catch (error) {
            if (error instanceof AppException) {
              throw error;
            }

            console.warn(`[BrowserService] goto attempt ${attempt}/${RETRY_COUNT} failed: ${error}`);

            if (attempt < RETRY_COUNT) {
              await page.waitForTimeout(RETRY_DELAY_MS * attempt);
            }
          }
        }

        throw new AppException(AppErrorName.BROWSER_NETWORK_ERROR);
      };

      Object.defineProperty(page, 'goto', {
        value: decoratedGoto,
      });
    });
  }

  private static async cleanPlaywrightProfiles(): Promise<void> {
    try {
      const tmpDir = os.tmpdir();
      const entries = await fs.readdir(tmpDir);

      const profiles = entries.filter((e) => e.startsWith('playwright_chromiumdev_profile')
      || e.startsWith('puppeteer_dev_profile'));

      await Promise.all(
        profiles.map((p) => fs.rm(path.join(tmpDir, p), { recursive: true, force: true })),
      );

      logger.info(`[Browser] Cleaned ${profiles.length} temp profiles`);
    } catch (error) {
      logger.error('[Browser] Failed to clean temp profiles', error);
    }
  }
}
