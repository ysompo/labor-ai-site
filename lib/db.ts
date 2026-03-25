import { sql as pgSql, createClient } from '@vercel/postgres';

// @vercel/postgres `sql` uses POSTGRES_URL (pool). If only the non-pooling
// URL is available, create a direct client and expose its sql tag instead.
function buildSql() {
  if (process.env.POSTGRES_URL) return pgSql;
  const nonPooling =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (nonPooling) {
    const client = createClient({ connectionString: nonPooling });
    // Connect lazily — the client connects on first query automatically
    return client.sql.bind(client) as typeof pgSql;
  }
  return pgSql; // no-op; isDbConfigured() will return false
}

export const sql = buildSql();

export function isDbConfigured(): boolean {
  return !!(
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL
  );
}
