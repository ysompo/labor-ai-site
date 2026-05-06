import { sql, isDbConfigured } from '@/lib/db';

let migrationsDone = false;
let columnsDone = false;

export async function runResearchMigrations(): Promise<void> {
  if (!isDbConfigured()) return;

  // Always run ADD COLUMN IF NOT EXISTS — idempotent and safe regardless of migrationsDone
  if (!columnsDone) {
    try {
      await sql`ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'`;
      await sql`ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
      await sql`ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS is_ai_suggested BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`;
      // phase column may exist with NOT NULL — make it nullable so inserts without it don't fail
      await sql`ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS phase VARCHAR(50)`;
      await sql`ALTER TABLE research_tasks ALTER COLUMN phase DROP NOT NULL`;
      await sql`ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS source_module VARCHAR(50)`;
      columnsDone = true;
    } catch { /* table may not exist yet — will be created below */ }
  }

  if (migrationsDone) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS research_messages (
        id SERIAL PRIMARY KEY,
        project_id BIGINT NOT NULL,
        module_id VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rm_proj_mod ON research_messages(project_id, module_id)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS research_module_touches (
        project_id BIGINT NOT NULL,
        module_id VARCHAR(50) NOT NULL,
        first_touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, module_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS research_tasks (
        id SERIAL PRIMARY KEY,
        project_id BIGINT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        due_date DATE,
        is_ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rt_proj ON research_tasks(project_id)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS research_memories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rmem_user ON research_memories(user_id)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS research_brief (
        id SERIAL PRIMARY KEY,
        project_id BIGINT NOT NULL,
        module_id VARCHAR(50) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, module_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS research_deferred_questions (
        id SERIAL PRIMARY KEY,
        project_id BIGINT NOT NULL,
        source_module VARCHAR(50) NOT NULL,
        target_module VARCHAR(50) NOT NULL,
        question TEXT NOT NULL,
        context TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rdq_proj ON research_deferred_questions(project_id)
    `;

    // Project IDs are timestamps that exceed INTEGER max — upgrade to BIGINT
    await sql`ALTER TABLE research_messages ALTER COLUMN project_id TYPE BIGINT`;
    await sql`ALTER TABLE research_module_touches ALTER COLUMN project_id TYPE BIGINT`;
    await sql`ALTER TABLE research_tasks ALTER COLUMN project_id TYPE BIGINT`;
    await sql`ALTER TABLE research_brief ALTER COLUMN project_id TYPE BIGINT`;
    await sql`ALTER TABLE research_deferred_questions ALTER COLUMN project_id TYPE BIGINT`;

    migrationsDone = true;
  } catch (e) {
    console.error('[research migrations]', e);
  }
}
