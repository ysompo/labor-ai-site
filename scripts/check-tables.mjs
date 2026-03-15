import { createClient } from '@vercel/postgres';

const client = createClient();
await client.connect();
const r = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
console.log('Tables:', r.rows.map(x => x.table_name).join(', ') || '(none)');
await client.end();
