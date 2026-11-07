import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  // All E2E tests are inside components/tests
  testDir: './components/tests',

  // ONLY files with .spec.ts or .test.ts are treated as test files.
  // stagetest.ts is explicitly included below.
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/stagetest.ts',
  ],

  fullyParallel: false,

  workers: 1,

  retries: 0,

  timeout: 120000,

  expect: {
    timeout: 15000,
  },

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: 'never',
      },
    ],
  ],

  use: {
    baseURL: 'http://192.168.1.3:3002',

    headless: false,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'retain-on-failure',

    viewport: {
      width: 1440,
      height: 900,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});