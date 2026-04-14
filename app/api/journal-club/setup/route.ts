import { sql } from '@vercel/postgres';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  // Require admin auth
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sim_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS jc_journals (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        publisher TEXT,
        toc_url TEXT NOT NULL,
        issn TEXT,
        has_new_issue BOOLEAN DEFAULT FALSE,
        current_issue_label TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS jc_toc_articles (
        id SERIAL PRIMARY KEY,
        journal_id INTEGER REFERENCES jc_journals(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT,
        authors TEXT[],
        article_type TEXT,
        doi TEXT,
        abstract TEXT,
        issue_label TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS jc_articles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES sim_users(id) ON DELETE CASCADE,
        title TEXT,
        doi TEXT,
        url TEXT,
        pmid TEXT,
        journal TEXT,
        authors TEXT[],
        pub_date TEXT,
        abstract TEXT,
        pdf_path TEXT,
        downloaded_at TIMESTAMP,
        is_bookmarked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS jc_reading_list (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES sim_users(id) ON DELETE CASCADE,
        article_id INTEGER REFERENCES jc_articles(id) ON DELETE CASCADE,
        toc_article_id INTEGER REFERENCES jc_toc_articles(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS jc_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES sim_users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        encrypted_value TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, key)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_jc_toc_articles_journal_id ON jc_toc_articles(journal_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jc_articles_user_id ON jc_articles(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jc_reading_list_user_id ON jc_reading_list(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jc_articles_doi ON jc_articles(doi)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jc_toc_articles_doi ON jc_toc_articles(doi)`;

    return NextResponse.json({ success: true, message: 'Journal Club tables created successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
