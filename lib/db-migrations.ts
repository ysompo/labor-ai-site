import { sql } from '@/lib/db';

/**
 * Run all required database migrations.
 * Safe to call multiple times (all use IF NOT EXISTS).
 */
export async function runAuthMigrations() {
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'trainee'`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS deactivated BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS invite_token VARCHAR(100)`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMPTZ`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS has_jc BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS has_ra BOOLEAN NOT NULL DEFAULT TRUE`;

  // Update role for admins
  await sql`UPDATE sim_users SET role = 'physician_instructor' WHERE is_admin = TRUE AND role = 'trainee'`;
}

/**
 * Seed initial admin user if database is empty.
 */
export async function seedAdminIfEmpty() {
  const { hashPassword } = await import('@/lib/auth');

  const count = await sql`SELECT COUNT(*) AS c FROM sim_users`;
  if (Number(count.rows[0].c) === 0) {
    const hash = await hashPassword('123456');
    await sql`
      INSERT INTO sim_users (username, password_hash, email, approved, is_admin, role)
      VALUES ('ysompo', ${hash}, 'ysompo@gmail.com', TRUE, TRUE, 'physician_instructor')
      ON CONFLICT (username) DO NOTHING
    `;
  }
}
