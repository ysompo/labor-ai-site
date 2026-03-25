import ResearchWorkspace from './ResearchWorkspace';

export default async function ResearchProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResearchWorkspace projectId={parseInt(id, 10)} />;
}
