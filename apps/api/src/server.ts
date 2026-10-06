import { buildApp } from './app.ts';
import { openDatabase } from './db/connection.ts';
import { migrate } from './db/migrate.ts';
import { listenOptions } from './listen-options.ts';
import { loggerOptions } from './logger.ts';

const { port, host } = listenOptions(process.env);

const db = openDatabase();
migrate(db);

const app = buildApp({ db, logger: loggerOptions });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port, host });
