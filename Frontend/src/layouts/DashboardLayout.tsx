import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import RouteFallback from '@/components/ui/RouteFallback';

export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0">
        <Navbar onMenuClick={() => setMobileNavOpen((v) => !v)} drawerOpen={mobileNavOpen} />
        <main className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-up">
          {/* Suspense here rather than around <App />: the sidebar and navbar
              are already on screen, so only the page area swaps for a skeleton
              while a route chunk arrives. */}
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
