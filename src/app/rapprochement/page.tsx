'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, FileCheck, Search, ArrowRight, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DossierItem {
  id: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  training_title: string | null;
  end_date: string | null;
  amount: number;
  wedof_status: string;
  pennylane_invoice_number: string | null;
  is_reconciled: boolean;
}

export default function RapprochementPage() {
  const [unreconciled, setUnreconciled] = useState<DossierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [search, setSearch] = useState('');

  const fetchUnreconciledDossiers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch pending dossiers (statusCategory=pending returns dossiers that are not reconciled and not cancelled)
      const res = await fetch('/api/dossiers?statusCategory=pending&pageSize=100', { cache: 'no-store' });
      if (!res.ok) throw new Error('Échec du chargement des dossiers en attente');
      const data = await res.json();
      setUnreconciled(data.dossiers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreconciledDossiers();
  }, []);

  const handleRunReconciliation = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync/pennylane', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'edof-cron-secret-2026'}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
      setSyncResult(data);
      fetchUnreconciledDossiers();
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : 'Erreur réseau'}`);
    } finally {
      setSyncing(false);
    }
  };

  const filtered = unreconciled.filter(d => {
    const term = search.toLowerCase();
    return (
      (d.last_name || '').toLowerCase().includes(term) ||
      (d.first_name || '').toLowerCase().includes(term) ||
      d.external_id.toLowerCase().includes(term) ||
      (d.pennylane_invoice_number || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-blue-500" />
            <span>Rapprochement Bancaire (Reconciliation)</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Associer les factures Pennylane payées aux dossiers d'apprentissage Wedof via un algorithme de similarité nominale et financière
          </p>
        </div>

        <button
          onClick={handleRunReconciliation}
          disabled={syncing}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Mutabakat en cours...' : 'Lancer le rapprochement'}</span>
        </button>
      </div>

      {/* Sync Results Banner */}
      {syncResult && (
        <div className="rounded-xl border border-blue-900/30 bg-blue-950/15 p-5 space-y-3">
          <h3 className="text-sm font-bold text-blue-400">Rapport de rapprochement</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
            <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40">
              <span className="text-zinc-500 block">Factures payées importées</span>
              <span className="text-zinc-200 text-lg font-extrabold mt-1 block">{syncResult.invoices_fetched}</span>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/15">
              <span className="text-emerald-400 block">Rapprochements effectués</span>
              <span className="text-emerald-400 text-lg font-extrabold mt-1 block">{syncResult.matched}</span>
            </div>
            <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40">
              <span className="text-zinc-500 block">Matchés par nom</span>
              <span className="text-zinc-200 mt-1 block text-sm">{syncResult.matched_by_name} dossiers</span>
            </div>
            <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40">
              <span className="text-zinc-500 block">Matchés par montant seul</span>
              <span className="text-zinc-200 mt-1 block text-sm">{syncResult.matched_by_amount_only} dossiers</span>
            </div>
          </div>
        </div>
      )}

      {/* Information Alert */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span>Comment fonctionne le rapprochement ?</span>
          </h4>
          <p className="text-xs text-zinc-500 font-medium max-w-2xl leading-relaxed">
            Notre moteur extrait le nom de l'apprenant à partir de la facture Pennylane (regex) et le compare aux dossiers de formation Wedof. Il calcule un score de similarité (Jaro-Winkler + Levenshtein). Si le score nominal est ≥ 0.8 et que le montant correspond (à ±1€ près), le dossier est marqué comme Payé/Rapproché et la date de paiement Pennylane est enregistrée.
          </p>
        </div>
      </div>

      {/* Unreconciled Table section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Dossiers en attente de paiement ({filtered.length})
          </h3>
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Filtrer en direct..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/30 pl-3 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
            />
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 glass-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="px-6 py-4">N° Dossier</th>
                  <th className="px-6 py-4">Apprenant</th>
                  <th className="px-6 py-4">Formation</th>
                  <th className="px-6 py-4">Date de fin</th>
                  <th className="px-6 py-4">Montant attendu</th>
                  <th className="px-6 py-4">Facture créée</th>
                  <th className="px-6 py-4">Rapprochement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 font-semibold animate-pulse">
                      Chargement des dossiers en attente...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 font-semibold">
                      Aucun dossier en attente de paiement. Tous les dossiers sont rapprochés !
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => window.location.href = `/dossiers/${d.id}`}
                      className="hover:bg-zinc-900/20 transition-all cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-blue-400">
                        {d.external_id}
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-200">
                        {d.last_name} {d.first_name}
                      </td>
                      <td className="px-6 py-4 max-w-[220px] truncate text-zinc-300">
                        {d.training_title || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-400 font-semibold">
                        {d.end_date ? format(parseISO(d.end_date), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-200">
                        {formatCurrency(d.amount)}
                      </td>
                      <td className="px-6 py-4">
                        {d.pennylane_invoice_number ? (
                          <span className="text-xs font-mono text-zinc-300 font-semibold">
                            🧾 {d.pennylane_invoice_number}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">Non facturé</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-500 border border-amber-500/20">
                          <AlertCircle className="h-3 w-3" /> En attente de paiement bank
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
