import { redirect } from 'next/navigation';

// This route is replaced by participant/[code] which has full feature parity
// plus polling fallback, portrait layout, and all override fields.
export default async function LiveDisplayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/tools/simulator/participant/${code}`);
}
