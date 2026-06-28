'use client';

import { usePathname } from 'next/navigation';
import { Menu, FileSpreadsheet, RotateCw } from 'lucide-react';

export function TopBar() {
  const pathname = usePathname();

  // Helper to determine page title
  const getPageTitle = () => {
    if (pathname === '/') return 'Tableau de bord';
    if (pathname?.startsWith('/dossiers')) return 'Gestion des Dossiers';
    if (pathname?.startsWith('/emails')) return "Centre d'e-mails";
    if (pathname?.startsWith('/billing')) return 'Opérations de Facturation';
    if (pathname?.startsWith('/rapprochement')) return 'Rapprochement Automatisé';
    if (pathname?.startsWith('/settings')) return 'Paramètres du Système';
    return 'EDOF';
  };

  const handleMobileMenuToggle = () => {
    window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
  };

  return (
    <header className="h-20 border-b border-zinc-900/40 bg-zinc-950/20 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Title & Mobile Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleMobileMenuToggle}
          className="flex md:hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-900/60 transition-colors"
          title="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-extrabold text-zinc-100 tracking-wider uppercase bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          {getPageTitle()}
        </span>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        <a
          href="/api/export"
          className="flex items-center gap-2 rounded-xl border border-zinc-900/60 bg-zinc-900/30 hover:bg-zinc-900/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-zinc-100 transition-all duration-300 shadow-sm"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
          <span className="hidden sm:inline">Exporter CSV</span>
        </a>
        
        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center rounded-xl bg-zinc-900/30 border border-zinc-900/60 p-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 hover:scale-105 shadow-sm transition-all duration-350"
          title="Actualiser les données"
        >
          <RotateCw className="h-3.5 w-3.5 text-blue-400" />
        </button>
      </div>
    </header>
  );
}
