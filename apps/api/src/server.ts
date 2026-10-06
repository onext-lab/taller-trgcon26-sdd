import { buildApp } from './app.ts';
import { openDatabase } from './db/connection.ts';
import { migrate } from './db/migrate.ts';
import { loggerOptions } from './logger.ts';

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? '127.0.0.1';

const db = openDatabase();
migrate(db);

const app = buildApp({ db, logger: loggerOptions });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port, host });
