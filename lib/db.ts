import { sql } from '@vercel/postgres';
export { sql };

export function isDbConfigured(): boolean {
  return !!process.env.POSTGRES_URL;
}
