'use server';

import { redirect } from 'next/navigation';

export async function joinSessionAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const raw = ((formData.get('code') as string) ?? '').trim().toUpperCase();
  if (!raw) return { error: 'נא להזין קוד סשן' };

  // Accept either "SIM-XXXX" or just "XXXX"
  const code = raw.startsWith('SIM-') ? raw : `SIM-${raw}`;

  redirect(`/tools/simulator/participant/${code}`);
}
