import { createClient } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = createClient();
await client.connect();

const schema = readFileSync(join(__dirname, '../sql/simulator_schema.sql'), 'utf8');

// Strip comments and split on semicolons
const cleaned = schema
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n');

const statements = cleaned
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 10);

console.log(`Found ${statements.length} statements`);

for (const stmt of statements) {
  const name = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1] ?? stmt.slice(0, 40);
  try {
    await client.query(stmt);
    console.log('✓', name);
  } catch (err) {
    console.error('✗', name, '-', err.message);
  }
}

await client.end();
console.log('Done.');
