import LoginForm from './LoginForm';

export default function ResearchLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; invite?: string }>;
}) {
  return <LoginForm searchParamsPromise={searchParams} />;
}
