import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Puertos propios de los e2e: conviven con `npm run dev` (3001 y 5173) sin pisarse.
const apiPort = 3101;
const webPort = 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Un solo worker: los ficheros de e2e comparten la misma base y no deben escribir a la vez.
  workers: 1,
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
      // En Playwright 1.63 los `webServer` arrancan ANTES que `globalSetup`: un `globalSetup` que borrase
      // `data/e2e.db` llegaría tarde, con la API ya con la base abierta (modo WAL) y escribiendo en ficheros
      // borrados. Por eso la base de e2e se regenera aquí, en el propio comando (`db:reset && start`;
      // `reset.ts` respeta `ATS_DB_PATH`). Con `reuseExistingServer: false`, puertos 3101/5174 y `workers: 1`
      // cada ejecución parte del mismo seed, sin tocar `data/ats.db`, y es compatible con `npm run dev`.
      command: 'npm run db:reset -w apps/api && npm run start -w apps/api',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      env: {
        ATS_DB_PATH: fileURLToPath(new URL('./data/e2e.db', import.meta.url)),
        API_PORT: String(apiPort),
        WEB_PORT: String(webPort),
      },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -w apps/web',
      url: `http://127.0.0.1:${webPort}`,
      // El proxy de Vite lee `API_PORT` (apps/web/vite.config.ts) y el puerto, `WEB_PORT`.
      env: { API_PORT: String(apiPort), WEB_PORT: String(webPort) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
