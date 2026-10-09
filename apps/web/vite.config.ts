import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = `http://127.0.0.1:${process.env.API_PORT ?? 3001}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': apiTarget },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    // Medido el 2026-10-09 (T-08 del sprint-02): el test más lento, 1,15 s solo y 1,68 s con 44 bucles activos en 11
    // núcleos. Un portátil 2-3× más lento lo deja cerca de los 5 s por defecto con los que fallaron 16 en HU-04; 10 s
    // dan el doble de margen y siguen cortando un test colgado en segundos.
    testTimeout: 10_000,
  },
});
