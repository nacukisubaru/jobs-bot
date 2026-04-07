import {
  chromium, BrowserContext, LaunchOptions, Page,
} from 'playwright';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { bot } from '../../bot/bot';
import { TG_CHAT_ID } from '../../common/constants/common';
import { BotMessageName } from '../../common/constants/bot';

export class BrowserService {
  private context: BrowserContext | null = null;

  private profilePath: string;

  constructor(profilePath: string) {
    this.profilePath = profilePath;
  }

  public getContext(): BrowserContext {
    return this.context!;
  }

  public async start(): Promise<BrowserContext> {
    if (this.context) return this.context;

    try {
      const options: LaunchOptions = {
        headless: false,
        viewport: null,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
      };

      this.context = await chromium.launchPersistentContext(this.profilePath, options);

      this.decorateContext();

      return this.context;
    } catch (error) {
      throw new AppException(AppErrorName.BROWSER_RUN_ERROR);
    }
  }

  public async stop(): Promise<void> {
    if (this.context) {
      await this.context.close();

      this.context = null;
    }
  }

  public async isAuth(): Promise<boolean> {
    if (!this.context) {
      throw new AppException(AppErrorName.BROWSER_CONTEXT_NOT_FOUND);
    }

    const cookies = await this.context.cookies();

    const isAuth = cookies.some((cookie) => cookie.domain.includes('hh.ru'));

    return isAuth;
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
        const result = await originalGoto(url, options);

        const isCaptcha = page.url().includes('captcha')
          || (await page.locator('iframe[src*="captcha"]').count()) > 0
          || (await page.locator('input[name*="captcha"]').count()) > 0
          || (await page.locator('input[id*="captcha"]').count()) > 0;

        const chatId = TG_CHAT_ID;

        if (isCaptcha) {
          bot.sendMessage(chatId, BotMessageName.CAPTCHA_DETECTED);

          throw new AppException(AppErrorName.BROWSER_CAPTCHA_DETECTED_ERROR);
        }

        if (!this.isAuth()) {
          bot.sendMessage(chatId, BotMessageName.AUTHORIZATION_IS_EXPIRED);

          throw new AppException(AppErrorName.BROWSER_AUTHORIZATION_IS_EXPIRED_ERROR);
        }

        return result;
      };

      Object.defineProperty(page, 'goto', {
        value: decoratedGoto,
      });
    });
  }
}
