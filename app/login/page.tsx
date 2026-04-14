import LoginForm from './LoginForm';

export default function UnifiedLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; invite?: string }>;
}) {
  return <LoginForm searchParamsPromise={searchParams} />;
}
