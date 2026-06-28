'use client';

import { usePathname } from 'next/navigation';
import { LogOut, BarChart3, Users, Mail, CreditCard, RotateCw, Settings as SettingsIcon, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  const pathname = usePathname();

  // Highlight active link helper
  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname?.startsWith(path)) return true;
    return false;
  };

  const navLinkClass = (path: string) => {
    const base = "relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300";
    if (isActive(path)) {
      return `${base} bg-blue-600/10 text-blue-400 border border-blue-500/25 tab-active-glow`;
    }
    return `${base} text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border border-transparent`;
  };

  return (
    <div className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 w-full max-w-[1400px] mx-auto">
      <header className="glass-panel w-full rounded-2xl px-6 py-3 flex items-center justify-between shadow-2xl shadow-black/80">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-300">
              ED
            </div>
            <div>
              <h1 className="text-xs font-extrabold text-zinc-100 tracking-wider uppercase bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">EDOF Dashboard</h1>
              <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">NETZ AGY FINANCIAL</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1.5 ml-6">
            <Link href="/" className={navLinkClass('/')}>
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Tableau de bord
            </Link>
            <Link href="/dossiers" className={navLinkClass('/dossiers')}>
              <Users className="h-4 w-4 text-indigo-400" />
              Dossiers
            </Link>
            <Link href="/emails" className={navLinkClass('/emails')}>
              <Mail className="h-4 w-4 text-pink-400" />
              E-mails
            </Link>
            <Link href="/billing" className={navLinkClass('/billing')}>
              <CreditCard className="h-4 w-4 text-emerald-400" />
              Facturation
            </Link>
            <Link href="/rapprochement" className={navLinkClass('/rapprochement')}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              Rapprochement
            </Link>
            <Link href="/settings" className={navLinkClass('/settings')}>
              <SettingsIcon className="h-4 w-4 text-zinc-400" />
              Paramètres
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/export"
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-850 hover:text-zinc-100 transition-all duration-300"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Exporter CSV</span>
          </a>
          
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline text-xs text-zinc-500 font-bold">admin@netzinformatique.fr</span>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors duration-300"
              title="Refresh"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}
