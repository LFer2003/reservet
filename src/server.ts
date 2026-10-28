import { app } from './app.js';
import { pool } from './shared/database.js';
import { config } from './shared/config.js';

const port = config.port;
const server = app.listen(port, config.host, () => {
  console.log(`Reservet: http://localhost:${port}`);
});

server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  void pool.end().finally(() => {
    process.exitCode = 1;
  });
});

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(() => {
      void pool
        .end()
        .then(() => {
          clearTimeout(timeout);
          process.exitCode = 0;
        })
        .catch(() => {
          process.exitCode = 1;
        });
    });
  });
}
