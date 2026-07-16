import { Link } from 'react-router-dom';
import VaultDial from '@/components/ui/VaultDial';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-center px-6">
      <VaultDial size={40} spinning />
      <h1 className="font-display text-3xl font-semibold mt-6">Locked out</h1>
      <p className="text-sm text-text-muted mt-2 max-w-sm">
        This page doesn't exist, or the combination is wrong. Let's get you back.
      </p>
      <Link to="/dashboard" className="btn-primary mt-6">
        Return to dashboard
      </Link>
    </div>
  );
}
