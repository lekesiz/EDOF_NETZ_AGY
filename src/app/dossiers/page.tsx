'use client';

import { useState, useEffect, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown, ExternalLink } from 'lucide-react';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DossierListItem {
  id: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  training_title: string | null;
  start_date: string | null;
  end_date: string | null;
  wedof_status: string;
  amount: number;
  is_reconciled: boolean;
  pennylane_invoice_number: string | null;
  pennylane_paid_date: string | null;
  wedof_paid_date: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function DossiersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state with defaults
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const statusCategory = searchParams.get('statusCategory') || 'all';
  const sortField = searchParams.get('sortField') || 'date';
  const sortDirection = searchParams.get('sortDirection') || 'desc';

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<{ dossiers: DossierListItem[]; pagination: Pagination } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    async function fetchDossiers() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          page: String(page),
          search,
          statusCategory,
          sortField,
          sortDirection,
          pageSize: '25',
        });
        const res = await fetch(`/api/dossiers?${query.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Échec du chargement des dossiers');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }
    fetchDossiers();
  }, [page, search, statusCategory, sortField, sortDirection]);

  const updateFilters = (newParams: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null) {
        params.delete(key);
      } else {
        params.set(key, String(val));
      }
    });
    // Reset to page 1 on search or filter change
    if (!('page' in newParams)) {
      params.set('page', '1');
    }
    startTransition(() => {
      router.push(`/dossiers?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput || null });
  };

  const handleSort = (field: string) => {
    const direction = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    updateFilters({ sortField: field, sortDirection: direction });
  };

  const formatDateString = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('cancel') || s.includes('refus') || s.includes('reject') || s.includes('annul') || s.includes('abandon')) {
      return 'bg-red-500/10 text-red-400 border border-red-500/25';
    }
    if (s === 'billed' || s.includes('paid') || s.includes('done') || s.includes('valid')) {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
    }
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('cancel') || s.includes('refus') || s.includes('reject') || s.includes('annul') || s.includes('abandon')) return 'Annulé';
    if (s === 'billed') return 'Facturé';
    if (s.includes('validate') || s.includes('done')) return 'Validé';
    if (s.includes('paid')) return 'Payé';
    return status;
  };

  if (loading && !data) {
    return <TableSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-6 text-center max-w-sm">
          <p className="text-sm font-semibold text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const dossiersList = data?.dossiers || [];
  const pagination = data?.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Title & Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Liste des Dossiers</h2>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            {pagination.total} dossiers trouvés au total
          </p>
        </div>
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/65 border border-zinc-850 p-1 rounded-xl w-fit">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'pending', label: 'En attente' },
            { id: 'paid', label: 'Payés / Rapprochés' },
            { id: 'cancelled', label: 'Annulés' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateFilters({ statusCategory: cat.id })}
              className={`rounded-lg px-4 py-1.5 text-xs font-extrabold transition-all duration-300 ${
                statusCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, email, n° dossier..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 premium-input transition-all"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-850 hover:text-zinc-100 transition-all flex items-center gap-2"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filtrer</span>
        </button>
      </form>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-4">
                  <button onClick={() => handleSort('external_id')} className="flex items-center gap-1.5 hover:text-zinc-200">
                    <span>N° Dossier</span>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1.5 hover:text-zinc-200">
                    <span>Apprenant</span>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => handleSort('training')} className="flex items-center gap-1.5 hover:text-zinc-200">
                    <span>Formation</span>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => handleSort('date')} className="flex items-center gap-1.5 hover:text-zinc-200">
                    <span>Dates de session</span>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => handleSort('amount')} className="flex items-center gap-1.5 hover:text-zinc-200">
                    <span>Montant</span>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Facture / Rapprochement</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-sm">
              {dossiersList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 font-semibold">
                    Aucun dossier ne correspond à la recherche.
                  </td>
                </tr>
              ) : (
                dossiersList.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-zinc-900/40 hover:scale-[1.002] transition-all duration-200 cursor-pointer"
                    onClick={() => router.push(`/dossiers/${d.id}`)}
                  >
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-blue-400">
                      {d.external_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-200">
                        {d.last_name} {d.first_name}
                      </div>
                      <div className="text-xs text-zinc-500">{d.email}</div>
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate text-zinc-300 font-medium">
                      {d.training_title || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">
                      <div>Du {formatDateString(d.start_date)}</div>
                      <div>au {formatDateString(d.end_date)}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-200">
                      {formatCurrency(d.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusBadgeClass(d.wedof_status)}`}>
                        {getStatusLabel(d.wedof_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {d.pennylane_invoice_number ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono text-zinc-300 font-semibold flex items-center gap-1">
                            🧾 {d.pennylane_invoice_number}
                          </span>
                          {d.is_reconciled ? (
                            <span className="inline-flex w-fit items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/25">
                              ✓ Rapproché
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500 border border-amber-500/25">
                              ⟳ En attente rapprochement
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Non facturé</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dossiers/${d.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-850 hover:text-zinc-100 transition-all"
                      >
                        <span>Détails</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/20 px-6 py-4">
            <div className="text-xs text-zinc-500 font-semibold">
              Page {pagination.page} sur {pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateFilters({ page: page - 1 })}
                disabled={page <= 1}
                className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => updateFilters({ page: page + 1 })}
                disabled={page >= pagination.totalPages}
                className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DossiersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <DossiersContent />
    </Suspense>
  );
}
