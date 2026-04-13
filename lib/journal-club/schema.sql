-- Create tables for Journal Club app
-- Run via: psql $POSTGRES_URL < lib/journal-club/schema.sql

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
);

CREATE TABLE IF NOT EXISTS jc_toc_articles (
  id SERIAL PRIMARY KEY,
  journal_id INTEGER REFERENCES jc_journals(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  authors TEXT[], -- PostgreSQL array of author names
  article_type TEXT,
  doi TEXT,
  abstract TEXT,
  issue_label TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

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
  pdf_path TEXT, -- S3 path or local (if needed)
  downloaded_at TIMESTAMP,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jc_reading_list (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES sim_users(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES jc_articles(id) ON DELETE CASCADE,
  toc_article_id INTEGER REFERENCES jc_toc_articles(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jc_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES sim_users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  encrypted_value TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS jc_access_requests (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, denied
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by INTEGER REFERENCES sim_users(id)
);

CREATE INDEX IF NOT EXISTS idx_jc_toc_articles_journal_id ON jc_toc_articles(journal_id);
CREATE INDEX IF NOT EXISTS idx_jc_articles_user_id ON jc_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_jc_reading_list_user_id ON jc_reading_list(user_id);
CREATE INDEX IF NOT EXISTS idx_jc_settings_user_id ON jc_settings(user_id);
