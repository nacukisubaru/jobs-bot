import { chromium } from 'playwright';
import fs from 'fs';
import { EXECUTABLE_BROWSER_PATH } from './common/constants/common';

async function run() {
  const browser = await chromium.launch({ headless: false, executablePath: EXECUTABLE_BROWSER_PATH });

  const context = await browser.newContext({
    storageState: 'hh-state.json',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: null,
  });

  const page = await context.newPage();

  await page.goto('https://hh.ru/account/login?role=applicant&backurl=%2F&hhtmFrom=main');

  await page.waitForTimeout(60000);

  const state = await context.storageState();
  fs.writeFileSync('hh-state.json', JSON.stringify(state));

  await page.close();
}

run();
