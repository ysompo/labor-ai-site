// Server component — awaits params and passes code as a plain string to the client component
import TraineeClient from './TraineeClient';

export default async function TraineePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TraineeClient code={code} />;
}

