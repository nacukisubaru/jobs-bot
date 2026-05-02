import { Locator, Page } from 'playwright';

type CheckboxTogglerConfig = {
  simpleCheckboxSelector: string;
  scrollableItemSelector: string;
  scrollableInputSelector: string;
  scrollableLabelSelector: string;
  scrollButtonSelector: string;
};

export class CheckboxToggler {
  constructor(
    private readonly page: Page,
    private readonly config: CheckboxTogglerConfig,
  ) {}

  async deactivateCheckboxes(): Promise<void> {
    const checkboxes = this.page.locator(this.config.simpleCheckboxSelector);

    await checkboxes.first().waitFor({ state: 'visible' });

    // Ждём пока все элементы появятся в DOM
    // await this.page.waitForFunction(
    //   (selector) => document.querySelectorAll(selector).length > 1,
    //   this.config.simpleCheckboxSelector,
    // );

    const count = await checkboxes.count();

    const deactivatedCheckboxes = [];

    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);

      await checkbox.scrollIntoViewIfNeeded();
      await checkbox.click();

      deactivatedCheckboxes.push(checkbox);
    }
  }

  async deactivateScrollableCheckboxes(): Promise<void> {
    await this.page.waitForSelector(this.config.scrollableItemSelector);

    const items = this.page.locator(this.config.scrollableItemSelector);

    const count = await items.count();

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const input = item.locator(this.config.scrollableInputSelector).first();

      if (await input.isDisabled()) continue;
      if (!await input.isChecked()) continue;

      const label = item.locator(this.config.scrollableLabelSelector).first();

      await this.clickWithScroll(label);

      await this.page.waitForTimeout(300);
    }
  }

  private async clickWithScroll(label: Locator): Promise<void> {
    const scrollBtn = this.page.locator(this.config.scrollButtonSelector);

    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await label.click({ timeout: 500 });

        return;
      } catch {
        const btnVisible = await scrollBtn.isVisible().catch(() => false);

        if (!btnVisible) break;

        await scrollBtn.click();
        await this.page.waitForTimeout(200);
      }
    }
  }

  // private async clickWithScroll(label: Locator): Promise<void> {
  //   const scrollBtn = this.page.locator(this.config.scrollButtonSelector);
  //   const MAX_ATTEMPTS = 10;

  //   for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  //     try {
  //       await label.scrollIntoViewIfNeeded();
  //       await label.click({ timeout: 500 });
  //       return; // успех
  //     } catch {
  //       const btnVisible = await scrollBtn.isVisible().catch(() => false);

  //       if (!btnVisible) {
  //       // скролл кончился, но клик не прошёл — пробуем force
  //         try {
  //           await label.click({ force: true, timeout: 1000 });
  //           return; // успех через force
  //         } catch (err) {
  //           throw new Error(`clickWithScroll: не удалось кликнуть после ${attempt + 1} попыток: ${err}`);
  //         }
  //       }

  //       await scrollBtn.click();
  //       await this.page.waitForTimeout(200);
  //     }
  //   }

  //   // исчерпали все попытки со скроллом — последний шанс через force
  //   try {
  //     await label.click({ force: true, timeout: 1000 });
  //   } catch (err) {
  //     throw new Error(`clickWithScroll: не удалось кликнуть после ${MAX_ATTEMPTS} попыток: ${err}`);
  //   }
  // }
}
