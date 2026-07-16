import { Outlet } from 'react-router-dom';
import VaultDial from '@/components/ui/VaultDial';

export default function AuthLayout() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink">
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 dial-ticks opacity-40" />
        <div className="relative flex items-center gap-2.5">
          <VaultDial size={28} />
          <span className="font-display font-semibold tracking-tight">
            Dev<span className="text-brass-400">Vault</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-3xl font-semibold leading-tight mb-4">
            Everything you build,
            <br /> locked in one place.
          </h1>
          <p className="text-text-muted text-sm leading-relaxed">
            Notes, snippets, projects, API collections and credentials — centralized, encrypted, and
            built for how developers actually work.
          </p>
        </div>

        <p className="relative text-xs text-text-faint font-mono">
          © 2026 DevVault. Built for developers, freelancers &amp; small teams.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
