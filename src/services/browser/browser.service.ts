import { chromium, BrowserContext, LaunchOptions } from 'playwright';

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

      return this.context;
    } catch (error) {
      console.log({ error });

      throw new Error('Ошибка при запуске хрома');
    }
  }

  public async stop(): Promise<void> {
    if (this.context) {
      await this.context.close();

      this.context = null;
    }
  }
}
