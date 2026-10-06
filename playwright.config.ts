import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const apiPort = Number(process.env.API_PORT ?? 3001);
const webPort = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Solo Chromium: es el único navegador que pedimos instalar en los portátiles del taller.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start -w apps/api',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      // Los e2e usan su propia base para no tocar data/ats.db.
      env: { ATS_DB_PATH: fileURLToPath(new URL('./data/e2e.db', import.meta.url)) },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -w apps/web',
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
