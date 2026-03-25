import { sql, isDbConfigured } from '@/lib/db';

let migrationsDone = false;

export async function runResearchMigrations(): Promise<void> {
  if (!isDbConfigured()) return;
  if (migrationsDone) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS research_messages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
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
        project_id INTEGER NOT NULL,
        module_id VARCHAR(50) NOT NULL,
        first_touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, module_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS research_tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
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

    migrationsDone = true;
  } catch (e) {
    console.error('[research migrations]', e);
  }
}
