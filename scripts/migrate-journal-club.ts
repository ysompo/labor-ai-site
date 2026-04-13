/**
 * Migration script: SQLite → PostgreSQL
 *
 * This script reads from the old SQLite journal_club.db
 * and imports data into Vercel PostgreSQL.
 *
 * Usage: SQLITE_DB_PATH=/path/to/db npx ts-node scripts/migrate-journal-club.ts
 * Default: ../../Journal Club/journal_club.db
 */

import { sql } from '@vercel/postgres';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlite3 = require('sqlite3');
import path from 'path';

const DEFAULT_SQLITE_PATH = path.join(process.cwd(), '../../Journal Club/journal_club.db');
const sqlitePath = process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_PATH;

interface JournalRow {
  id: number;
  name: string;
  publisher: string | null;
  toc_url: string;
  issn: string | null;
  has_new_issue: boolean;
  current_issue_label: string | null;
}

interface ArticleRow {
  id: number;
  title: string;
  doi: string | null;
  url: string;
  pmid: string | null;
  journal: string;
  authors: string[];
  pub_date: string;
  abstract: string;
  pdf_path: string | null;
  downloaded_at: string | null;
  is_bookmarked: boolean;
}

interface TOCArticleRow {
  id: number;
  journal_id: number;
  url: string;
  title: string;
  authors: string[];
  article_type: string;
  doi: string | null;
  abstract: string;
  issue_label: string;
}

function getSQLiteConnection(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqlitePath, (err: Error | null) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function querySQLite<T>(
  db: unknown,
  sql: string
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const dbAny = db as Record<string, (sql: string, callback: (err: Error | null, rows: unknown) => void) => void>;
    dbAny.all(sql, (err: Error | null, rows: unknown) => {
      if (err) reject(err);
      else resolve((rows || []) as T[]);
    });
  });
}

async function migrateJournals(db: unknown) {
  console.log('Migrating journals...');
  const rows = await querySQLite<JournalRow>(db, 'SELECT * FROM journals');

  for (const row of rows) {
    try {
      await sql`
        INSERT INTO jc_journals (id, name, publisher, toc_url, issn, has_new_issue, current_issue_label)
        VALUES (${row.id}, ${row.name}, ${row.publisher}, ${row.toc_url}, ${row.issn}, ${row.has_new_issue}, ${row.current_issue_label})
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (e) {
      console.error(`  ⚠️  Error inserting journal ${row.name}:`, e);
    }
  }
  console.log(`  ✓ Migrated ${rows.length} journals`);
}

async function migrateArticles(db: unknown) {
  console.log('Migrating articles...');
  try {
    const rows = await querySQLite<ArticleRow>(db, 'SELECT * FROM articles');

    // Note: articles reference user_id, which may not exist in PostgreSQL
    // For now, we'll migrate with a placeholder admin user (id=1)
    for (const row of rows) {
      try {
        await sql`
          INSERT INTO jc_articles (title, doi, url, pmid, journal, authors, pub_date, abstract, pdf_path, downloaded_at, is_bookmarked, user_id)
          VALUES (${row.title}, ${row.doi}, ${row.url}, ${row.pmid}, ${row.journal}, ${JSON.stringify(row.authors)}, ${row.pub_date}, ${row.abstract}, ${row.pdf_path}, ${row.downloaded_at}, ${row.is_bookmarked}, 1)
          ON CONFLICT DO NOTHING
        `;
      } catch (e) {
        console.error(`  ⚠️  Error inserting article ${row.title}:`, e);
      }
    }
    console.log(`  ✓ Migrated ${rows.length} articles (assigned to admin user)`);
  } catch (e) {
    console.warn(`  ⚠️  Articles table not found or empty (optional)`);
  }
}

async function migrateTOCArticles(db: unknown) {
  console.log('Migrating TOC articles...');
  try {
    const rows = await querySQLite<TOCArticleRow>(db, 'SELECT * FROM toc_articles');

    for (const row of rows) {
      try {
        await sql`
          INSERT INTO jc_toc_articles (journal_id, url, title, authors, article_type, doi, abstract, issue_label)
          VALUES (${row.journal_id}, ${row.url}, ${row.title}, ${JSON.stringify(row.authors)}, ${row.article_type}, ${row.doi}, ${row.abstract}, ${row.issue_label})
          ON CONFLICT DO NOTHING
        `;
      } catch (e) {
        console.error(`  ⚠️  Error inserting TOC article ${row.title}:`, e);
      }
    }
    console.log(`  ✓ Migrated ${rows.length} TOC articles`);
  } catch (e) {
    console.warn(`  ⚠️  TOC articles table not found or empty (optional)`);
  }
}

async function main() {
  console.log('🔄 Starting migration: SQLite → PostgreSQL');
  console.log(`📂 SQLite path: ${sqlitePath}`);
  console.log('');

  let db: unknown | null = null;

  try {
    // Verify PostgreSQL connection
    const pgResult = await sql`SELECT NOW()`;
    console.log('✅ Connected to PostgreSQL');

    // Open SQLite connection
    db = await getSQLiteConnection();
    console.log('✅ Connected to SQLite');
    console.log('');

    // Run migrations
    await migrateJournals(db);
    await migrateArticles(db);
    await migrateTOCArticles(db);

    console.log('');
    console.log('✅ Migration complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Ensure SQLite connection is closed
    if (db) {
      const dbAny = db as Record<string, (callback: (err: Error | null) => void) => void>;
      dbAny.close((err: Error | null) => {
        if (err) console.error('Error closing SQLite:', err);
      });
    }
  }
}

main();
