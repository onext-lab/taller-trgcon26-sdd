import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { openDatabase } from '../src/db/connection.ts';
import { loggerOptions } from '../src/logger.ts';

describe('logs de la API', () => {
  it('no registran la query ni la IP de origen (pueden llevar datos personales)', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const app = buildApp({ db: openDatabase(':memory:'), logger: { ...loggerOptions, stream } });

    await app.inject({ method: 'GET', url: '/api/health?q=ana.inventada@example.com' });
    await app.close();

    const logs = lines.join('');
    expect(logs).toContain('"path":"/api/health"');
    expect(logs).not.toContain('ana.inventada@example.com');
    expect(logs).not.toContain('?q=');
    expect(logs).not.toContain('remoteAddress');
  });
});
