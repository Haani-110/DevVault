import { Outlet } from 'react-router-dom';
import VaultDial from '@/components/ui/VaultDial';
import VaultHero from '@/components/ui/VaultHero';

export default function AuthLayout() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink">
      {/* Left panel — brand hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border relative overflow-hidden dial-ticks">
        {/* Soft radial gold glow behind the dial */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 55% at 68% 55%, rgba(232,163,61,0.10), transparent 70%)',
          }}
        />

        {/* Large decorative vault dial, bleeding off the edge for an
            asymmetric, art-directed composition rather than a centered stock effect */}
        <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-[560px] h-[560px] opacity-90 pointer-events-none">
          <VaultHero />
        </div>

        {/* Subtle grain texture for tactility, over everything */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none mix-blend-overlay opacity-[0.05]">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        {/* Vignette so text stays readable over the dial */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(11,10,10,0.55) 0%, rgba(11,10,10,0.15) 45%, transparent 70%)',
          }}
        />

        {/* Text content */}
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
            Notes, snippets, and projects — centralized and built for how
            developers actually work.
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
