import { chromium } from "playwright";

async function run() {
  const context = await chromium.launchPersistentContext(
    "./hh-profile",
    {
      headless: false,
      viewport: null,
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      args: [
        "--start-maximized",
        "--disable-blink-features=AutomationControlled"
      ]
    }
  );

  const page = await context.newPage();

  await page.goto("https://hh.ru/account/login?role=applicant&backurl=%2F&hhtmFrom=main");

  await page.waitForTimeout(100000000000000000000000000);

}

run();