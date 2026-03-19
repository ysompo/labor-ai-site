import { redirect } from 'next/navigation';

// Entry point for trainees — join page has QR scanner + auth identity
export default function ParticipantRootPage() {
  redirect('/tools/simulator/join');
}
