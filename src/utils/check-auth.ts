import { chromium } from "playwright";

export default async function checkAuth(profilePath: string) {
  try {
    const context = await chromium.launchPersistentContext(
      profilePath,
      {
        headless: false,
        channel: "chrome",
      }
    );

    const cookies = await context.cookies();

    const isAuth = cookies.some((cookie) => cookie.domain.includes('hh.ru'));

    await context.close();

    return isAuth;
  } catch (err) {
    console.log(err)
    return false;
  }
}
