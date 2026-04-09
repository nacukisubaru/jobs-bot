export async function sleep(delay: number) {
  return new Promise((r) => { setTimeout(r, delay); });
}

export const hours = (h: number) => h * 60 * 60 * 1000;
export const minutes = (m: number) => m * 60 * 1000;
export const seconds = (s: number) => s * 1000;
