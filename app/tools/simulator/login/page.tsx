// Server Component — reads searchParams directly, passes to client form
import LoginForm from './LoginForm';

export default function SimulatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; invite?: string }>;
}) {
  // searchParams is a Promise in Next.js 15 App Router
  return <LoginForm searchParamsPromise={searchParams} />;
}
