import { Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import VaultDial from '@/components/ui/VaultDial';

// Lazy-load the heavy Three.js scene so it doesn't block the auth form
const AuthScene3D = lazy(() => import('@/components/3d/AuthScene3D'));

export default function AuthLayout() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink">
      {/* Left panel — 3D animated vault scene */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        {/* 3D canvas fills the whole panel */}
        <Suspense fallback={<div className="absolute inset-0 dial-ticks opacity-30" />}>
          <AuthScene3D />
        </Suspense>

        {/* Gradient vignette so text stays readable over the 3D scene */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 20% 50%, transparent 30%, rgba(10,13,22,0.55) 80%), ' +
              'linear-gradient(to right, rgba(10,13,22,0.15) 0%, rgba(10,13,22,0.0) 100%)',
          }}
        />

        {/* Text content — sits above the canvas */}
        <div className="relative flex items-center gap-2.5 z-10">
          <VaultDial size={28} />
          <span className="font-display font-semibold tracking-tight">
            Dev<span className="text-brass-400">Vault</span>
          </span>
        </div>

        <div className="relative max-w-md z-10">
          <h1 className="font-display text-3xl font-semibold leading-tight mb-4">
            Everything you build,
            <br /> locked in one place.
          </h1>
          <p className="text-text-muted text-sm leading-relaxed">
            Notes, snippets, projects, API collections and credentials — centralized,
            encrypted, and built for how developers actually work.
          </p>
        </div>

        <p className="relative text-xs text-text-faint font-mono z-10">
          © 2026 DevVault. Built for developers, freelancers &amp; small teams.
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
