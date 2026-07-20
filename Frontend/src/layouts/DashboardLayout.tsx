import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';

export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0">
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
