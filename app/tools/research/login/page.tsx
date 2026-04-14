import { redirect } from 'next/navigation';

export default async function ResearchLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; invite?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.redirect) qs.set('redirect', params.redirect);
  if (params.invite)   qs.set('invite',   params.invite);
  redirect(`/login${qs.toString() ? '?' + qs.toString() : ''}`);
}
