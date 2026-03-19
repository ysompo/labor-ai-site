// Server Component — reads searchParams on the server, passes to client
import JoinForm from './JoinForm';

export default function JoinSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  return <JoinForm searchParamsPromise={searchParams} />;
}
