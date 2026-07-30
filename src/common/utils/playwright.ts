import { Page } from 'playwright';

export const closeModalIfExists = async (page: Page): Promise<void> => {
  if (!page) return;

  try {
    const overlay = page.locator('[data-qa="bottom-sheet-overlay"]');

    await overlay.waitFor({ state: 'visible', timeout: 10000 });
    await overlay.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('[closeModalIfExists] modal closed via Escape');
  } catch {
    console.log('[closeModalIfExists] модалки нет, продолжаем');
  }
};
