import {
  chromium, BrowserContext, Page,
} from 'playwright';

import { bot } from '../../bot/bot';

import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
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
      this.context = await chromium.launchPersistentContext(this.profilePath, {
        headless: true,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        args: ['--window-size=1920,1080', '--disable-blink-features=AutomationControlled'],
        viewport: { width: 1920, height: 1080 },
      });

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
        let result;

        try {
          result = await originalGoto(url, options);
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : '';

          const isNetworkError = [
            'net::err_internet_disconnected',
            'net::err_network_changed',
            'net::err_connection_refused',
            'net::err_connection_timed_out',
            'net::err_name_not_resolved',
            'econnrefused',
            'enotfound',
            'etimedout',
            'socket hang up',
          ].some((pattern) => message.includes(pattern));

          if (isNetworkError) {
            throw new AppException(AppErrorName.BROWSER_NETWORK_ERROR);
          }
        }

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
