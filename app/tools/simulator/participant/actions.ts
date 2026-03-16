'use server';

import { redirect } from 'next/navigation';
import { isDbConfigured, sql } from '@/lib/db';

export async function joinSessionAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const code = ((formData.get('code') as string) ?? '').trim().toUpperCase();
  if (!code) return { error: 'נא להזין קוד סשן' };

  if (isDbConfigured()) {
    try {
      const result = await sql`SELECT session_code FROM sim_sessions WHERE session_code = ${code}`;
      if (result.rows.length === 0) return { error: 'קוד סשן לא נמצא — בדוק שוב' };
    } catch {
      // allow through on DB error
    }
  }

  redirect(`/tools/simulator/participant/${code}`);
}
