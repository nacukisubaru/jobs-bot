// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    envFile: '.env',
  },
});
