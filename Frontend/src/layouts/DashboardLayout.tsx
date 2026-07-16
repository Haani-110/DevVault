import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Navbar />
        <main className="p-6 max-w-7xl mx-auto animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
