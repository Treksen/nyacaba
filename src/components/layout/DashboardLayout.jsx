import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-cream-50 flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1400px] w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
        <footer className="py-6 px-6 text-center text-xs text-ink-500 border-t border-cream-200 bg-cream-100/40">
          <p>
            © {new Date().getFullYear()} Nyacaba Family. All
            Rights Reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
