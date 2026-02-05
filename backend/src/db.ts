import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set (check backend/.env)');
  }

  _pool = new Pool({ connectionString: url });
  return _pool;
}
