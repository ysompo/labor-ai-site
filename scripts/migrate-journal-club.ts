/**
 * Migration script: SQLite → PostgreSQL
 *
 * This script reads from the old SQLite journal_club.db
 * and imports data into Vercel PostgreSQL.
 *
 * Usage: npx ts-node scripts/migrate-journal-club.ts
 */

import { sql } from '@vercel/postgres';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlite3 = require('sqlite3');
import path from 'path';

const sqlitePath = path.join(process.cwd(), '../../Journal Club/journal_club.db');

interface JournalRow {
  name: string;
  publisher?: string;
  toc_url: string;
  issn?: string;
  has_new_issue?: boolean;
  current_issue_label?: string;
}

async function migrateJournals() {
  console.log('Migrating journals...');

  return new Promise<void>((resolve, reject) => {
    const db = new sqlite3.Database(sqlitePath, (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      db.all('SELECT * FROM journals', async (err: Error | null, rows: JournalRow[]) => {
        if (err) {
          reject(err);
          return;
        }

        for (const row of rows || []) {
          try {
            await sql`
              INSERT INTO jc_journals (name, publisher, toc_url, issn, has_new_issue, current_issue_label)
              VALUES (${row.name}, ${row.publisher || null}, ${row.toc_url}, ${row.issn || null}, ${row.has_new_issue || false}, ${row.current_issue_label || null})
              ON CONFLICT DO NOTHING
            `;
          } catch (e) {
            console.error(`Error inserting journal ${row.name}:`, e);
          }
        }

        db.close(() => {
          resolve();
        });
      });
    });
  });
}

async function main() {
  console.log('Starting migration: SQLite → PostgreSQL');
  console.log(`SQLite path: ${sqlitePath}`);

  try {
    // Verify connection to PostgreSQL
    const result = await sql`SELECT NOW()`;
    console.log('✓ Connected to PostgreSQL:', result.rows[0]);

    // Run migration
    await migrateJournals();

    console.log('✓ Migration complete');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

main();
