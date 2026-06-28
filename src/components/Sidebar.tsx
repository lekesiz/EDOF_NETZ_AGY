'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, 
  Users, 
  Mail, 
  CreditCard, 
  RotateCw, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  LogOut,
  Activity
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Persistence of collapsed state
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
  };

  // Listen to custom window events for mobile drawer control
  useEffect(() => {
    const handleToggleMobile = () => setIsMobileOpen(prev => !prev);
    const handleCloseMobile = () => setIsMobileOpen(false);

    window.addEventListener('toggle-mobile-sidebar', handleToggleMobile);
    window.addEventListener('close-mobile-sidebar', handleCloseMobile);
    
    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggleMobile);
      window.removeEventListener('close-mobile-sidebar', handleCloseMobile);
    };
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname?.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { name: 'Tableau de bord', path: '/', icon: BarChart3, color: 'text-blue-400' },
    { name: 'Dossiers', path: '/dossiers', icon: Users, color: 'text-indigo-400' },
    { name: 'E-mails', path: '/emails', icon: Mail, color: 'text-pink-400' },
    { name: 'Facturation', path: '/billing', icon: CreditCard, color: 'text-emerald-400' },
    { 
      name: 'Rapprochement', 
      path: '/rapprochement', 
      icon: RotateCw, 
      color: 'text-orange-400',
      badge: true
    },
    { 
      name: 'Webhooks', 
      path: '/webhooks', 
      icon: Activity, 
      color: 'text-cyan-400' 
    },
    { name: 'Paramètres', path: '/settings', icon: SettingsIcon, color: 'text-zinc-400' }
  ];

  if (!mounted) {
    // Avoid layout shift by rendering a placeholder matching initial server render
    return (
      <aside className="hidden md:flex flex-col h-screen w-64 bg-zinc-950/90 border-r border-zinc-900 flex-shrink-0" />
    );
  }

  const sidebarWidthClass = isCollapsed ? 'w-20' : 'w-64';

  return (
    <>
      {/* Mobile Sidebar Overlay backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:sticky inset-y-0 left-0 z-50 flex flex-col h-screen bg-zinc-950/90 border-r border-zinc-900/60 transition-all duration-300 ease-in-out flex-shrink-0
        ${sidebarWidthClass}
        ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header/Logo Section */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-zinc-900/40 relative">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
              ED
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="transition-opacity duration-300">
                <h1 className="text-xs font-extrabold text-zinc-100 tracking-wider uppercase bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                  EDOF Dashboard
                </h1>
                <p className="text-[8px] text-zinc-500 font-bold tracking-widest uppercase mt-0.5">
                  NETZ AGY FINANCIAL
                </p>
              </div>
            )}
          </Link>

          {/* Close button for mobile menu */}
          {isMobileOpen && (
            <button 
              onClick={() => setIsMobileOpen(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Collapse toggle button for desktop sidebar */}
          <button
            onClick={toggleCollapse}
            className="absolute -right-3 top-8 hidden md:flex h-6 w-6 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 hover:scale-110 shadow-lg transition-all duration-200"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`
                  relative flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 group
                  ${active 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border border-transparent'
                  }
                `}
              >
                {/* Active Indicator Line */}
                {active && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                )}

                <Icon className={`h-4.5 w-4.5 flex-shrink-0 transition-transform group-hover:scale-105 duration-200 ${item.color}`} />
                
                {(!isCollapsed || isMobileOpen) ? (
                  <span className="truncate flex-1">{item.name}</span>
                ) : null}

                {/* Status Indicator Badge */}
                {item.badge && (!isCollapsed || isMobileOpen) && (
                  <span className="relative flex h-2.5 w-2.5 ml-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile section at the bottom */}
        <div className="p-4 border-t border-zinc-900/40 bg-zinc-950/40">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-900/20 border border-zinc-900/40">
            {(!isCollapsed || isMobileOpen) ? (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 font-bold text-xs text-zinc-300 flex-shrink-0">
                  AD
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-zinc-300 truncate">Admin</p>
                  <p className="text-[8px] text-zinc-500 font-semibold truncate">admin@netzinformatique.fr</p>
                </div>
                <a 
                  href="/api/auth/logout"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Se déconnecter"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </a>
              </>
            ) : (
              <a 
                href="/api/auth/logout"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800 transition-all duration-200 mx-auto"
                title="Se déconnecter"
              >
                <LogOut className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
