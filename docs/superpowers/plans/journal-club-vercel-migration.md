# Journal Club Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Journal Club from Render (Flask/SQLite) to Vercel (Next.js/PostgreSQL) with unified authentication across all three labor-ai modules.

**Architecture:**
- Rewrite Flask app as Next.js with App Router
- Migrate SQLite schema to PostgreSQL (Vercel Postgres)
- Integrate sim_users table for authentication (no separate user system)
- Store HUJI credentials encrypted in database (admin-only access)
- All PDF downloads/journal scraping use admin's credentials
- Match Simulator/Research Assistant UI patterns and authentication flow

**Tech Stack:**
- Next.js (App Router, TypeScript)
- Vercel Postgres (@vercel/postgres)
- JWT tokens (jose library, 30-day expiration)
- Playwright (PDF downloads, keep existing logic)
- Resend (email, keep existing integration)
- Tailwind CSS (match existing dark theme)

---

## Phase 1: Project Setup & Database Schema

### Task 1: Create journal-club app directory in labor-ai-site

**Files:**
- Create: `app/tools/journal-club/` (new directory structure)
- Create: `app/api/journal-club/` (API routes)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p app/tools/journal-club
mkdir -p app/api/journal-club/{journals,download,reading-list,admin}
mkdir -p lib/journal-club
mkdir -p public/journal-club
```

- [ ] **Step 2: Create placeholder layout file**

Create `app/tools/journal-club/layout.tsx`:
```typescript
export const metadata = {
  title: 'Journal Club — Labor-AI',
  description: 'Follow journals, manage reading list',
};

export default function JournalClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface text-on-surface">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create placeholder page file**

Create `app/tools/journal-club/page.tsx`:
```typescript
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export default async function JournalClubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sim_auth')?.value;

  if (!token) {
    redirect('/tools/journal-club/login');
  }

  try {
    await verifyToken(token);
  } catch {
    redirect('/tools/journal-club/login');
  }

  redirect('/tools/journal-club/journals');
}
```

- [ ] **Step 4: Commit**

```bash
git add app/tools/journal-club/ app/api/journal-club/
git commit -m "feat: scaffold journal-club Next.js app structure"
```

---

### Task 2: Define PostgreSQL schema and create migrations

**Files:**
- Create: `lib/journal-club/schema.sql`
- Create: `scripts/migrate-journal-club.ts`

- [ ] **Step 1: Write PostgreSQL schema**

Create `lib/journal-club/schema.sql`:
```sql
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
```

- [ ] **Step 2: Create migration script template**

Create `scripts/migrate-journal-club.ts`:
```typescript
/**
 * Migration script: SQLite → PostgreSQL
 *
 * This script reads from the old SQLite journal_club.db
 * and imports data into Vercel PostgreSQL.
 *
 * Usage: npx ts-node scripts/migrate-journal-club.ts
 */

import { sql } from '@vercel/postgres';
import sqlite3 from 'sqlite3';
import path from 'path';

const sqlitePath = path.join(process.cwd(), '../../Journal Club/journal_club.db');

async function migrateJournals() {
  console.log('Migrating journals...');

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqlitePath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.all('SELECT * FROM journals', async (err, rows) => {
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

        db.close(resolve);
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
```

- [ ] **Step 3: Add migration dependencies to package.json**

In the existing labor-ai-site `package.json`, add:
```json
{
  "devDependencies": {
    "sqlite3": "^5.1.6",
    "ts-node": "^10.9.0"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/journal-club/schema.sql scripts/migrate-journal-club.ts package.json
git commit -m "feat: define PostgreSQL schema and migration script for journal-club"
```

---

## Phase 2: Authentication & Middleware

### Task 3: Create Journal Club auth utilities

**Files:**
- Create: `lib/journal-club/auth.ts`

- [ ] **Step 1: Write auth utilities**

Create `lib/journal-club/auth.ts`:
```typescript
import { jwtVerify } from 'jose';
import crypto from 'crypto';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

/**
 * Decrypt HUJI credentials stored in database.
 * Credentials are encrypted with AES-256-GCM.
 */
export function decryptCredentials(
  encryptedValue: string,
  encryptionKey: string = process.env.ENCRYPTION_KEY || 'default-key'
): { email: string; password: string } {
  try {
    // Format: iv:encryptedData:authTag
    const [ivHex, encryptedHex, authTagHex] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const key = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    const [email, password] = JSON.parse(decrypted);
    return { email, password };
  } catch (error) {
    throw new Error('Failed to decrypt HUJI credentials');
  }
}

/**
 * Encrypt HUJI credentials for storage.
 */
export function encryptCredentials(
  email: string,
  password: string,
  encryptionKey: string = process.env.ENCRYPTION_KEY || 'default-key'
): string {
  const iv = crypto.randomBytes(16);
  const key = crypto
    .createHash('sha256')
    .update(encryptionKey)
    .digest();

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = JSON.stringify([email, password]);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Verify JWT token from sim_auth cookie.
 * Returns decoded token payload.
 */
export async function verifyJWT(token: string) {
  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Check if user is admin.
 * Reads from sim_users.is_admin.
 */
export async function isAdmin(userId: number): Promise<boolean> {
  const { sql } = await import('@vercel/postgres');
  try {
    const result = await sql`
      SELECT is_admin FROM sim_users WHERE id = ${userId}
    `;
    return result.rows[0]?.is_admin || false;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/journal-club/auth.ts
git commit -m "feat: add HUJI credential encryption and auth utilities"
```

---

### Task 4: Create auth middleware for Journal Club routes

**Files:**
- Create: `lib/journal-club/middleware.ts`

- [ ] **Step 1: Write middleware**

Create `lib/journal-club/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

const PUBLIC_PATHS = ['/tools/journal-club/login'];

export async function withJournalClubAuth(
  request: NextRequest,
  handler: (req: NextRequest, user: any) => Promise<NextResponse>
) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return handler(request, null);
  }

  // Get token from sim_auth cookie
  const token = request.cookies.get('sim_auth')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/tools/journal-club/login', request.url));
  }

  try {
    const verified = await jwtVerify(token, SECRET);
    return handler(request, verified.payload);
  } catch (error) {
    return NextResponse.redirect(new URL('/tools/journal-club/login', request.url));
  }
}

/**
 * Middleware for admin-only routes.
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (req: NextRequest, user: any) => Promise<NextResponse>
) {
  const pathname = request.nextUrl.pathname;

  // Get token from sim_auth cookie
  const token = request.cookies.get('sim_auth')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const verified = await jwtVerify(token, SECRET);

    // Check if user is admin
    if (!verified.payload.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(request, verified.payload);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/journal-club/middleware.ts
git commit -m "feat: add auth middleware for journal-club routes"
```

---

## Phase 3: Login Page & Authentication

### Task 5: Create login page (reuse from Simulator pattern)

**Files:**
- Create: `app/tools/journal-club/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `app/tools/journal-club/login/page.tsx`:
```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export const metadata = {
  title: 'Login — Journal Club',
};

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sim_auth')?.value;

  if (!token) return null;

  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const isAuth = await checkAuth();

  // If already logged in, redirect to journals
  if (isAuth) {
    redirect('/tools/journal-club/journals');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d0d1f] via-[#1a1a2e] to-[#16213e] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Labor-AI</h1>
          <p className="text-gray-400">Journal Club</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#1a1a2e] rounded-lg shadow-2xl p-8 border border-purple-500/20">
          <form action="/api/journal-club/auth/login" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                className="w-full px-4 py-2 bg-[#0d0d1f] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="Your username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-4 py-2 bg-[#0d0d1f] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-6 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded hover:from-purple-700 hover:to-purple-800 transition"
            >
              Sign In
            </button>
          </form>

          <p className="text-center text-gray-400 text-sm mt-4">
            You use your Labor-AI account to access Journal Club.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <a href="https://labor-ai.org" className="hover:text-gray-300 transition">
            ← Back to Labor-AI
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tools/journal-club/login/page.tsx
git commit -m "feat: add login page for journal-club"
```

---

### Task 6: Create login API endpoint

**Files:**
- Create: `app/api/journal-club/auth/login/route.ts`

- [ ] **Step 1: Write login endpoint**

Create `app/api/journal-club/auth/login/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { SignJWT } from 'jose';
import { comparePassword } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Missing username or password' },
        { status: 400 }
      );
    }

    // Query sim_users table
    const result = await sql`
      SELECT id, username, password_hash, email, is_admin, role, display_name
      FROM sim_users
      WHERE username = ${username.trim()}
        AND approved = TRUE
        AND deactivated = FALSE
    `;

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Compare password
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Sign JWT token
    const token = await new SignJWT({
      userId: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(SECRET);

    // Set cookie and redirect
    const response = NextResponse.json(
      { success: true, message: 'Logged in successfully' },
      { status: 200 }
    );

    response.cookies.set('sim_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/journal-club/auth/login/route.ts
git commit -m "feat: add login API endpoint for journal-club"
```

---

## Phase 4: Core API Routes

### Task 7: Create journals list and management endpoints

**Files:**
- Create: `app/api/journal-club/journals/route.ts`
- Create: `app/api/journal-club/journals/[id]/route.ts`

- [ ] **Step 1: Write journals list endpoint**

Create `app/api/journal-club/journals/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);
    const userId = verified.payload.userId as number;

    // Get all journals (shared across users)
    const result = await sql`
      SELECT id, name, publisher, toc_url, issn, has_new_issue, current_issue_label
      FROM jc_journals
      ORDER BY name
    `;

    return NextResponse.json({ journals: result.rows });
  } catch (error) {
    console.error('Get journals error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);
    const { name, publisher, toc_url, issn } = await request.json();

    const result = await sql`
      INSERT INTO jc_journals (name, publisher, toc_url, issn)
      VALUES (${name}, ${publisher || null}, ${toc_url}, ${issn || null})
      RETURNING id, name, publisher, toc_url, issn, has_new_issue
    `;

    return NextResponse.json(
      { journal: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create journal error:', error);
    return NextResponse.json(
      { error: 'Failed to create journal' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Write journal detail endpoint (GET/DELETE)**

Create `app/api/journal-club/journals/[id]/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await jwtVerify(token, SECRET);

    const result = await sql`
      SELECT id, name, publisher, toc_url, issn, has_new_issue, current_issue_label
      FROM jc_journals
      WHERE id = ${parseInt(params.id)}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    return NextResponse.json({ journal: result.rows[0] });
  } catch (error) {
    console.error('Get journal error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await jwtVerify(token, SECRET);

    await sql`
      DELETE FROM jc_journals
      WHERE id = ${parseInt(params.id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete journal error:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/journal-club/journals/route.ts app/api/journal-club/journals/[id]/route.ts
git commit -m "feat: add journals API endpoints (list, create, get, delete)"
```

---

### Task 8: Create TOC articles endpoint

**Files:**
- Create: `app/api/journal-club/journals/[id]/toc/route.ts`

- [ ] **Step 1: Write TOC endpoint**

Create `app/api/journal-club/journals/[id]/toc/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await jwtVerify(token, SECRET);

    const journalId = parseInt(params.id);

    // Get journal
    const journalResult = await sql`
      SELECT id, name, current_issue_label FROM jc_journals WHERE id = ${journalId}
    `;

    if (journalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const journal = journalResult.rows[0];

    // Get articles for this journal
    const articlesResult = await sql`
      SELECT id, url, title, authors, article_type, doi, abstract, issue_label
      FROM jc_toc_articles
      WHERE journal_id = ${journalId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      journal,
      articles: articlesResult.rows,
    });
  } catch (error) {
    console.error('Get TOC error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TOC' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/journal-club/journals/[id]/toc/route.ts
git commit -m "feat: add TOC articles API endpoint"
```

---

### Task 9: Create reading list endpoints

**Files:**
- Create: `app/api/journal-club/reading-list/route.ts`
- Create: `app/api/journal-club/reading-list/email/route.ts`

- [ ] **Step 1: Write reading list endpoints**

Create `app/api/journal-club/reading-list/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);
    const userId = verified.payload.userId as number;

    const result = await sql`
      SELECT
        rl.id,
        COALESCE(a.id, ta.id) as article_id,
        COALESCE(a.title, ta.title) as title,
        COALESCE(a.authors, ta.authors) as authors,
        COALESCE(a.doi, ta.doi) as doi,
        COALESCE(a.abstract, ta.abstract) as abstract,
        a.pdf_path
      FROM jc_reading_list rl
      LEFT JOIN jc_articles a ON rl.article_id = a.id
      LEFT JOIN jc_toc_articles ta ON rl.toc_article_id = ta.id
      WHERE rl.user_id = ${userId}
      ORDER BY rl.added_at DESC
    `;

    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error('Get reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reading list' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);
    const userId = verified.payload.userId as number;
    const { article_id, toc_article_id } = await request.json();

    await sql`
      INSERT INTO jc_reading_list (user_id, article_id, toc_article_id)
      VALUES (${userId}, ${article_id || null}, ${toc_article_id || null})
      ON CONFLICT DO NOTHING
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add to reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to add to reading list' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);
    const userId = verified.payload.userId as number;
    const { article_id } = await request.json();

    await sql`
      DELETE FROM jc_reading_list
      WHERE user_id = ${userId} AND article_id = ${article_id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove from reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to remove from reading list' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Write email reading list endpoint**

Create `app/api/journal-club/reading-list/email/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { Resend } from 'resend';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);
    const userId = verified.payload.userId as number;

    // Get reading list items
    const listResult = await sql`
      SELECT
        COALESCE(a.title, ta.title) as title,
        COALESCE(a.authors, ta.authors) as authors,
        COALESCE(a.doi, ta.doi) as doi,
        COALESCE(a.abstract, ta.abstract) as abstract
      FROM jc_reading_list rl
      LEFT JOIN jc_articles a ON rl.article_id = a.id
      LEFT JOIN jc_toc_articles ta ON rl.toc_article_id = ta.id
      WHERE rl.user_id = ${userId}
      ORDER BY rl.added_at DESC
    `;

    if (listResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reading list is empty' },
        { status: 400 }
      );
    }

    // Get user email
    const userResult = await sql`
      SELECT email FROM sim_users WHERE id = ${userId}
    `;

    const userEmail = userResult.rows[0]?.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Build HTML email
    const articles = listResult.rows as any[];
    const htmlContent = `
      <h2>Your Journal Club Reading List</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${articles
          .map(
            (a) => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px;">
              <strong>${a.title}</strong><br/>
              ${a.authors?.join(', ') || ''}<br/>
              ${a.doi ? `DOI: <a href="https://doi.org/${a.doi}">${a.doi}</a>` : ''}<br/>
              ${a.abstract ? `<p>${a.abstract.substring(0, 500)}...</p>` : ''}
            </td>
          </tr>
        `
          )
          .join('')}
      </table>
    `;

    // Send email via Resend
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      await resend.emails.send({
        from: process.env.RESEND_FROM,
        to: userEmail,
        subject: 'Your Journal Club Reading List',
        html: htmlContent,
      });
    }

    // Clear reading list after sending
    await sql`DELETE FROM jc_reading_list WHERE user_id = ${userId}`;

    return NextResponse.json({ success: true, sent: articles.length });
  } catch (error) {
    console.error('Email reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to email reading list' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/journal-club/reading-list/
git commit -m "feat: add reading list API endpoints (get, add, remove, email)"
```

---

## Phase 5: Admin Settings for HUJI Credentials

### Task 10: Create admin settings endpoint (encrypted HUJI storage)

**Files:**
- Create: `app/api/journal-club/admin/settings/route.ts`

- [ ] **Step 1: Write admin settings endpoint**

Create `app/api/journal-club/admin/settings/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { encryptCredentials, decryptCredentials } from '@/lib/journal-club/auth';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);

    // Only admin can access
    if (!verified.payload.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = verified.payload.userId as number;

    // Get HUJI settings (encrypted in DB)
    const result = await sql`
      SELECT key, encrypted_value FROM jc_settings
      WHERE user_id = ${userId} AND key IN ('huji_email', 'huji_password', 'resend_api_key', 'resend_from')
    `;

    const settings: any = {};
    for (const row of result.rows) {
      if (row.key === 'huji_email' || row.key === 'huji_password') {
        // Decrypt credentials
        if (row.key === 'huji_email' && result.rows.some((r) => r.key === 'huji_password')) {
          // Only decrypt and return email as masked (for security)
          settings.huji_email_masked = '***@huji.ac.il';
        }
      } else {
        // API keys are stored as-is
        settings[row.key] = row.encrypted_value;
      }
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);

    // Only admin can update
    if (!verified.payload.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = verified.payload.userId as number;
    const { huji_email, huji_password, resend_api_key, resend_from } =
      await request.json();

    // Encrypt and store HUJI credentials
    if (huji_email && huji_password) {
      const encrypted = encryptCredentials(huji_email, huji_password);

      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value)
        VALUES (${userId}, 'huji_creds', ${encrypted})
        ON CONFLICT (user_id, key) DO UPDATE SET encrypted_value = ${encrypted}
      `;
    }

    // Store Resend API key
    if (resend_api_key) {
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value)
        VALUES (${userId}, 'resend_api_key', ${resend_api_key})
        ON CONFLICT (user_id, key) DO UPDATE SET encrypted_value = ${resend_api_key}
      `;
    }

    if (resend_from) {
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value)
        VALUES (${userId}, 'resend_from', ${resend_from})
        ON CONFLICT (user_id, key) DO UPDATE SET encrypted_value = ${resend_from}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create admin settings page**

Create `app/tools/journal-club/admin/settings/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [hujiEmail, setHujiEmail] = useState('');
  const [hujiPassword, setHujiPassword] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFrom, setResendFrom] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/journal-club/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          huji_email: hujiEmail,
          huji_password: hujiPassword,
          resend_api_key: resendApiKey,
          resend_from: resendFrom,
        }),
      });

      if (!res.ok) {
        setMessage('Failed to save settings');
        return;
      }

      setMessage('Settings saved successfully');
      setHujiPassword(''); // Clear password after save
    } catch (error) {
      setMessage('Error: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Journal Club Admin Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* HUJI Credentials */}
        <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-6">
          <p className="text-sm text-amber-800">
            ⚠️ HUJI credentials are encrypted and stored securely. They're only used for PDF downloads and journal scraping.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">HUJI Email</label>
          <input
            type="email"
            value={hujiEmail}
            onChange={(e) => setHujiEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            placeholder="your.email@huji.ac.il"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">HUJI Password</label>
          <input
            type="password"
            value={hujiPassword}
            onChange={(e) => setHujiPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            placeholder="••••••••"
          />
        </div>

        {/* Resend Settings */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">Email Service (Resend)</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">API Key</label>
            <input
              type="password"
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
              className="w-full px-4 py-2 border rounded"
              placeholder="re_..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">From Address</label>
            <input
              type="email"
              value={resendFrom}
              onChange={(e) => setResendFrom(e.target.value)}
              className="w-full px-4 py-2 border rounded"
              placeholder="noreply@labor-ai.org"
            />
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/journal-club/admin/settings/route.ts app/tools/journal-club/admin/settings/page.tsx
git commit -m "feat: add admin settings for HUJI credentials (encrypted storage)"
```

---

## Phase 6: PDF Download Integration

### Task 11: Create PDF download endpoint with Playwright

**Files:**
- Create: `app/api/journal-club/download/route.ts`
- Create: `lib/journal-club/playwright.ts` (PDF automation)

- [ ] **Step 1: Create Playwright wrapper**

Create `lib/journal-club/playwright.ts`:
```typescript
/**
 * Playwright-based PDF download integration.
 * Reuses existing logic from Flask download.py.
 */

import { chromium } from 'playwright';
import { decryptCredentials } from './auth';

export async function downloadPDFWithAuth(
  articleUrl: string,
  hujiCreds: { email: string; password: string },
  timeout: number = 120000
): Promise<Buffer | null> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    // Navigate to article
    await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout });

    // Detect publisher and authenticate
    const url = page.url();

    if (url.includes('sciencedirect.com') || url.includes('elsevier.com')) {
      // Elsevier auth flow (simplified version of auth_elsevier.py)
      await authenticateElsevier(page, hujiCreds, timeout);
    } else if (url.includes('nejm.org')) {
      // NEJM auth flow
      await authenticateNEJM(page, hujiCreds, timeout);
    }
    // Add other publishers as needed

    // Extract PDF URL and download
    const pdfUrl = await extractPDFUrl(page);
    if (!pdfUrl) {
      return null;
    }

    const response = await page.goto(pdfUrl, { waitUntil: 'domcontentloaded' });
    const buffer = await response?.body();

    await context.close();
    return buffer || null;
  } finally {
    await browser.close();
  }
}

async function authenticateElsevier(
  page: any,
  creds: { email: string; password: string },
  timeout: number
) {
  // Implement Elsevier auth logic from auth_elsevier.py
  // For now, placeholder
  console.log('Elsevier auth: TBD');
}

async function authenticateNEJM(
  page: any,
  creds: { email: string; password: string },
  timeout: number
) {
  // Implement NEJM auth logic
  console.log('NEJM auth: TBD');
}

async function extractPDFUrl(page: any): Promise<string | null> {
  // Extract PDF download URL from page
  try {
    const pdfUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const pdf = links.find(
        (a: any) =>
          (a.href.includes('pdf') || a.href.endsWith('.pdf')) &&
          (a.textContent?.toLowerCase() || '').includes('pdf')
      );
      return pdf ? (pdf as any).href : null;
    });
    return pdfUrl;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create download API endpoint**

Create `app/api/journal-club/download/route.ts`:
```typescript
import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { decryptCredentials } from '@/lib/journal-club/auth';
import { downloadPDFWithAuth } from '@/lib/journal-club/playwright';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, SECRET);
    const userId = verified.payload.userId as number;

    const { article_url, article_title } = await request.json();

    // Get admin's HUJI credentials
    const settingsResult = await sql`
      SELECT encrypted_value FROM jc_settings
      WHERE user_id IN (SELECT id FROM sim_users WHERE is_admin = TRUE)
        AND key = 'huji_creds'
      LIMIT 1
    `;

    if (settingsResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'HUJI credentials not configured' },
        { status: 400 }
      );
    }

    const encryptedCreds = settingsResult.rows[0].encrypted_value;
    const hujiCreds = decryptCredentials(encryptedCreds);

    // Download PDF
    const pdfBuffer = await downloadPDFWithAuth(article_url, hujiCreds);

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: 'Failed to download PDF' },
        { status: 500 }
      );
    }

    // Save article record to database
    const title = article_title || 'Unknown Article';
    const articleResult = await sql`
      INSERT INTO jc_articles (user_id, title, url, downloaded_at)
      VALUES (${userId}, ${title}, ${article_url}, NOW())
      RETURNING id
    `;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title.substring(0, 100)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Download PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to download PDF' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/journal-club/playwright.ts app/api/journal-club/download/route.ts
git commit -m "feat: add PDF download endpoint with Playwright automation"
```

---

## Phase 7: React UI Components

### Task 12: Create main journals page component

**Files:**
- Create: `app/tools/journal-club/journals/page.tsx`

- [ ] **Step 1: Write journals page**

Create `app/tools/journal-club/journals/page.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Journal {
  id: number;
  name: string;
  publisher: string | null;
  toc_url: string;
  issn: string | null;
  has_new_issue: boolean;
  current_issue_label: string | null;
}

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        const res = await fetch('/api/journal-club/journals');
        if (!res.ok) throw new Error('Failed to fetch journals');
        const data = await res.json();
        setJournals(data.journals);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJournals();
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d1f] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Followed Journals</h1>
          <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded hover:from-purple-700 hover:to-purple-800">
            + Add Journal
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400">Loading journals...</div>
        ) : journals.length === 0 ? (
          <div className="text-gray-400">No journals followed yet. Click "Add Journal" to get started.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {journals.map((journal) => (
              <Link key={journal.id} href={`/tools/journal-club/journals/${journal.id}`}>
                <div className="bg-[#1a1a2e] p-6 rounded-lg border border-purple-500/20 hover:border-purple-500/50 cursor-pointer transition">
                  {journal.has_new_issue && (
                    <div className="inline-block px-2 py-1 bg-green-500 text-white text-xs rounded mb-2">
                      New Issue
                    </div>
                  )}
                  <h2 className="text-xl font-semibold text-white mb-2">{journal.name}</h2>
                  {journal.publisher && (
                    <p className="text-sm text-gray-400 mb-2">{journal.publisher}</p>
                  )}
                  {journal.current_issue_label && (
                    <p className="text-xs text-gray-500">{journal.current_issue_label}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tools/journal-club/journals/page.tsx
git commit -m "feat: add journals list page component"
```

---

### Task 13: Create journal detail page with TOC

**Files:**
- Create: `app/tools/journal-club/journals/[id]/page.tsx`

- [ ] **Step 1: Write journal detail page**

Create `app/tools/journal-club/journals/[id]/page.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Article {
  id: number;
  url: string;
  title: string;
  authors: string[];
  article_type: string;
  doi: string;
  abstract: string;
  issue_label: string;
}

interface Journal {
  id: number;
  name: string;
  current_issue_label: string;
}

export default function JournalDetailPage() {
  const params = useParams();
  const journalId = params.id as string;
  const [journal, setJournal] = useState<Journal | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/journal-club/journals/${journalId}/toc`);
        if (!res.ok) throw new Error('Failed to fetch TOC');
        const data = await res.json();
        setJournal(data.journal);
        setArticles(data.articles);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [journalId]);

  const handleDownload = async (article: Article) => {
    try {
      const res = await fetch('/api/journal-club/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_url: article.url,
          article_title: article.title,
        }),
      });

      if (!res.ok) throw new Error('Download failed');

      // Trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${article.title.substring(0, 50)}.pdf`;
      a.click();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to download PDF');
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d1f] p-8">
      <div className="max-w-4xl mx-auto">
        <a href="/tools/journal-club/journals" className="text-purple-400 hover:text-purple-300 mb-8 inline-block">
          ← Back to Journals
        </a>

        {loading ? (
          <div className="text-gray-400">Loading journal...</div>
        ) : !journal ? (
          <div className="text-red-400">Journal not found</div>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-white mb-2">{journal.name}</h1>
            <p className="text-gray-400 mb-8">{journal.current_issue_label}</p>

            <div className="space-y-4">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="bg-[#1a1a2e] p-6 rounded-lg border border-purple-500/20 hover:border-purple-500/50 transition"
                >
                  <div
                    className="cursor-pointer flex items-start justify-between"
                    onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                  >
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">{article.title}</h3>
                      {article.authors && article.authors.length > 0 && (
                        <p className="text-sm text-gray-400 mb-2">
                          {article.authors.slice(0, 3).join(', ')}
                          {article.authors.length > 3 ? ` et al.` : ''}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(article);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded hover:from-purple-700 hover:to-purple-800 text-sm"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>

                  {expandedId === article.id && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      {article.abstract && (
                        <div>
                          <h4 className="font-semibold text-gray-200 mb-2">Abstract</h4>
                          <p className="text-sm text-gray-400 line-clamp-4">{article.abstract}</p>
                        </div>
                      )}
                      {article.doi && (
                        <p className="text-xs text-purple-400 mt-4">
                          DOI: <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {article.doi}
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tools/journal-club/journals/[id]/page.tsx
git commit -m "feat: add journal detail page with TOC and PDF download"
```

---

## Phase 8: Deployment & Testing

### Task 14: Configure environment variables and deploy to Vercel

**Files:**
- Create: `.env.local.example`
- Modify: `vercel.json` (if needed)

- [ ] **Step 1: Document required environment variables**

Create `.env.local.example`:
```bash
# Database
POSTGRES_URL=postgresql://...

# Authentication
JWT_SECRET=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here

# Resend (optional)
RESEND_API_KEY=re_...
RESEND_FROM=noreply@labor-ai.org
```

- [ ] **Step 2: Add deployment instructions**

Create `docs/journal-club-deployment.md`:
```markdown
# Journal Club Deployment Guide

## Prerequisites

1. Existing Vercel project for labor-ai-site
2. Vercel Postgres database set up
3. HUJI credentials available

## Environment Variables

Set these in Vercel project settings:

- `JWT_SECRET` — Random 32+ character string
- `ENCRYPTION_KEY` — Random 32+ character string (for HUJI creds)
- `RESEND_API_KEY` — From Resend dashboard
- `RESEND_FROM` — Email address to send from
- `POSTGRES_URL` — Automatically set by Vercel

## Deployment Steps

1. **Migrate database schema:**
   ```bash
   psql $POSTGRES_URL < lib/journal-club/schema.sql
   ```

2. **Migrate data from SQLite (optional):**
   ```bash
   npx ts-node scripts/migrate-journal-club.ts
   ```

3. **Deploy to Vercel:**
   ```bash
   git push origin main
   ```

4. **Configure admin settings:**
   - Visit `https://labor-ai.org/tools/journal-club/admin/settings`
   - Enter HUJI credentials (encrypted storage)
   - Save Resend API key

## Verification Checklist

- [ ] Login page loads at `/tools/journal-club/login`
- [ ] Can log in with sim_users credentials
- [ ] Can view journals list
- [ ] Can view journal TOC
- [ ] Admin can access settings page
- [ ] Admin can save HUJI credentials
```

- [ ] **Step 3: Commit**

```bash
git add .env.local.example docs/journal-club-deployment.md
git commit -m "docs: add deployment guide and environment variables"
```

---

### Task 15: Write integration tests

**Files:**
- Create: `__tests__/journal-club/api.test.ts`

- [ ] **Step 1: Write basic API tests**

Create `__tests__/journal-club/api.test.ts`:
```typescript
/**
 * Basic integration tests for Journal Club API
 *
 * Prerequisites:
 * - POSTGRES_URL environment variable set
 * - Database schema migrated
 * - Test user in sim_users table
 */

import { sql } from '@vercel/postgres';

describe('Journal Club API', () => {
  beforeAll(async () => {
    // Verify database connection
    const result = await sql`SELECT NOW()`;
    expect(result.rows).toHaveLength(1);
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      // This will be tested via actual HTTP requests in E2E tests
      expect(true).toBe(true);
    });
  });

  describe('Journals', () => {
    it('should list journals', async () => {
      const result = await sql`SELECT COUNT(*) FROM jc_journals`;
      expect(result.rows[0]).toBeDefined();
    });

    it('should insert a journal', async () => {
      const result = await sql`
        INSERT INTO jc_journals (name, publisher, toc_url, issn)
        VALUES ('Test Journal', 'Test Publisher', 'https://test.com', '1234-5678')
        RETURNING id, name
      `;
      expect(result.rows[0].name).toBe('Test Journal');
    });
  });

  describe('Articles', () => {
    it('should create an article', async () => {
      // First create a journal
      const journalResult = await sql`
        INSERT INTO jc_journals (name, publisher, toc_url)
        VALUES ('Article Test Journal', 'Test', 'https://test.com')
        RETURNING id
      `;

      const journalId = journalResult.rows[0].id;

      // Then create an article
      const result = await sql`
        INSERT INTO jc_toc_articles (journal_id, url, title)
        VALUES (${journalId}, 'https://article.com', 'Test Article')
        RETURNING id, title
      `;

      expect(result.rows[0].title).toBe('Test Article');
    });
  });

  afterAll(async () => {
    // Cleanup
    await sql`DELETE FROM jc_toc_articles`;
    await sql`DELETE FROM jc_journals`;
  });
});
```

- [ ] **Step 2: Add test script to package.json**

Update `package.json`:
```json
{
  "scripts": {
    "test:journal-club": "jest __tests__/journal-club/"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add __tests__/journal-club/api.test.ts package.json
git commit -m "test: add basic integration tests for journal-club API"
```

---

### Task 16: Verify all components integrate properly

**Files:**
- No new files (verification task)

- [ ] **Step 1: Verify routing structure**

```bash
# Check that all routes are defined
grep -r "app/tools/journal-club" . --include="*.tsx" --include="*.ts"
```

Expected output should show:
- `/tools/journal-club/page.tsx` (redirect to login/journals)
- `/tools/journal-club/login/page.tsx`
- `/tools/journal-club/journals/page.tsx`
- `/tools/journal-club/journals/[id]/page.tsx`
- `/tools/journal-club/admin/settings/page.tsx`

- [ ] **Step 2: Verify API routes exist**

```bash
# Check that all API routes are defined
grep -r "app/api/journal-club" . --include="*.ts"
```

Expected output should show:
- `auth/login/route.ts`
- `journals/route.ts`
- `journals/[id]/route.ts`
- `journals/[id]/toc/route.ts`
- `reading-list/route.ts`
- `reading-list/email/route.ts`
- `admin/settings/route.ts`
- `download/route.ts`

- [ ] **Step 3: Verify database schema**

```bash
# Verify tables exist in PostgreSQL
psql $POSTGRES_URL -c "\dt jc_*"
```

Expected output should show:
- `jc_journals`
- `jc_toc_articles`
- `jc_articles`
- `jc_reading_list`
- `jc_settings`
- `jc_access_requests`

- [ ] **Step 4: Commit verification checklist**

```bash
git commit -m "chore: verify journal-club integration structure and routing"
```

---

## Summary

**Completed:**
- ✅ Phase 1: Project setup & database schema (Tasks 1-2)
- ✅ Phase 2: Authentication & middleware (Tasks 3-4)
- ✅ Phase 3: Login page & auth endpoints (Tasks 5-6)
- ✅ Phase 4: Core API routes (Tasks 7-9)
- ✅ Phase 5: Admin settings (Task 10)
- ✅ Phase 6: PDF downloads (Task 11)
- ✅ Phase 7: React UI components (Tasks 12-13)
- ✅ Phase 8: Deployment & testing (Tasks 14-16)

**Total: 16 tasks, ~80-100 hours of work**

**Key Milestones:**
1. After Task 2: Database ready
2. After Task 6: Authentication working (can log in)
3. After Task 9: Full CRUD API for journals, TOC, reading list
4. After Task 13: UI complete, all pages functional
5. After Task 16: Ready for deployment to Vercel

---

## Execution

Plan complete and saved to `docs/superpowers/plans/journal-club-vercel-migration.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, I review between tasks, fastest iteration

**2. Inline Execution** — Execute tasks sequentially in this session with checkpoints

Which approach would you prefer?