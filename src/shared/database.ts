import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000,
  max: 10,
});
pool.on('error', (error) => console.error('Error de conexión PostgreSQL', error.message));
