import { useState } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dark min-h-screen bg-dark-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile header */}
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-dark-600 bg-dark-800 px-4 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-md p-2 text-gray-400 hover:bg-dark-700 hover:text-gray-100"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
        <div className="ml-4 flex items-center">
          <span className="text-lg font-bold text-neon-green">Loop</span>
          <span className="text-lg font-bold text-gray-100">Trading</span>
        </div>
      </header>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}
