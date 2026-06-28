'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Play, Eye, CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight, CornerDownRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BillingLog {
  id: string;
  run_id: string | null;
  dossier_external_id: string;
  dossier_first_name: string | null;
  dossier_last_name: string | null;
  amount: number;
  pennylane_invoice_number: string | null;
  status: string;
  error_message: string | null;
  failed_step: string | null;
  triggered_by: string;
  duration_ms: number | null;
  created_at: string;
}

interface StepLog {
  id: string;
  stepName: string;
  stepOrder: number;
  status: string;
  inputData: any;
  outputData: any;
  errorMessage: string | null;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function BillingPage() {
  const [logs, setLogs] = useState<BillingLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Trigger billing state
  const [runningBilling, setRunningBilling] = useState(false);
  const [billingSummary, setBillingSummary] = useState<any | null>(null);

  // Selected log details (modal/panel)
  const [selectedLog, setSelectedLog] = useState<BillingLog | null>(null);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (statusFilter !== 'all') {
        query.set('status', statusFilter);
      }
      const res = await fetch(`/api/billing?${query.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Échec du chargement des logs de facturation');
      const data = await res.json();
      setLogs(data.logs);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter]);

  const handleFetchSteps = async (log: BillingLog) => {
    setSelectedLog(log);
    setStepLogs([]);
    setLoadingSteps(true);
    try {
      const res = await fetch(`/api/billing?logId=${log.id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Échec du chargement des étapes');
      const data = await res.json();
      setStepLogs(data.steps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSteps(false);
    }
  };

  const handleRunBilling = async () => {
    if (!confirm('Voulez-vous lancer le cycle de facturation automatique maintenant ?')) return;
    setRunningBilling(true);
    setBillingSummary(null);
    try {
      const res = await fetch('/api/cron/billing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'edof-cron-secret-2026'}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
      setBillingSummary(data);
      fetchLogs();
    } catch (err) {
      alert(`Erreur fatale : ${err instanceof Error ? err.message : 'Erreur réseau'}`);
    } finally {
      setRunningBilling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="h-3 w-3" /> Réussi</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/20"><XCircle className="h-3 w-3" /> Échoué</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-500 border border-amber-500/20"><Clock className="h-3 w-3 text-amber-500" /> En cours</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-500" />
            <span>Journal de Facturation</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Historique des tentatives de facturation automatique et intégration Pennylane
          </p>
        </div>

        <button
          onClick={handleRunBilling}
          disabled={runningBilling}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 shrink-0 self-start sm:self-auto"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>{runningBilling ? 'Facturation en cours...' : 'Lancer le cycle auto'}</span>
        </button>
      </div>

      {/* Manual Execution Banner */}
      {billingSummary && (
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-5 space-y-3">
          <h3 className="text-sm font-bold text-emerald-400">Rapport de Facturation Manuelle</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40">
              <span className="text-zinc-500 block">Dossiers trouvés</span>
              <span className="text-zinc-200 text-lg font-extrabold mt-1 block">{billingSummary.processed}</span>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/15">
              <span className="text-emerald-500 block">Facturés avec succès</span>
              <span className="text-emerald-400 text-lg font-extrabold mt-1 block">{billingSummary.succeeded}</span>
            </div>
            <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/15">
              <span className="text-red-500 block">Échecs</span>
              <span className="text-red-400 text-lg font-extrabold mt-1 block">{billingSummary.failed}</span>
            </div>
            <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40">
              <span className="text-zinc-500 block">Durée</span>
              <span className="text-zinc-200 text-lg font-extrabold mt-1 block">{(billingSummary.duration_ms / 1000).toFixed(2)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Layout split with Steps panel if a log is selected */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Logs Table */}
        <div className={selectedLog ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
          {/* Filters */}
          <div className="flex gap-2">
            {['all', 'success', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all border ${
                  statusFilter === status
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                    : 'bg-zinc-950/20 border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {status === 'all' ? 'Tous' : status === 'success' ? 'Réussis' : 'Échecs'}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Dossier</th>
                    <th className="px-5 py-4">Apprenant</th>
                    <th className="px-5 py-4">Montant</th>
                    <th className="px-5 py-4">Statut</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-sm">
                  {loading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 font-semibold animate-pulse">
                        Chargement des journaux de facturation...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 font-semibold">
                        Aucune tentative de facturation enregistrée.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => handleFetchSteps(log)}
                        className={`hover:bg-zinc-900/20 transition-all cursor-pointer ${
                          selectedLog?.id === log.id ? 'bg-blue-600/5 hover:bg-blue-600/10' : ''
                        }`}
                      >
                        <td className="px-5 py-4 text-xs text-zinc-400 font-semibold whitespace-nowrap">
                          {format(parseISO(log.created_at), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-blue-400">
                          {log.dossier_external_id}
                        </td>
                        <td className="px-5 py-4 text-zinc-200 font-bold">
                          {log.dossier_last_name} {log.dossier_first_name}
                        </td>
                        <td className="px-5 py-4 text-zinc-300 font-semibold">
                          {formatCurrency(log.amount)}
                        </td>
                        <td className="px-5 py-4">{getStatusBadge(log.status)}</td>
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleFetchSteps(log)}
                            className="rounded bg-zinc-900 border border-zinc-850 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
                            title="Voir les étapes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/20 px-5 py-3">
                <span className="text-xs text-zinc-500 font-semibold">
                  Page {pagination.page} sur {pagination.totalPages}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 transition-all font-semibold"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 transition-all font-semibold"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audit Details Panel (Right side) */}
        {selectedLog && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5 space-y-6 self-start">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-zinc-100 text-sm">Détail des Étapes</h3>
                <p className="text-[10px] font-semibold font-mono text-blue-400 mt-0.5">Dossier: {selectedLog.dossier_external_id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            {loadingSteps ? (
              <div className="text-xs text-zinc-500 text-center py-12">
                Chargement des détails de l'audit...
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-850">
                {stepLogs.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic text-center py-6">
                    Aucune étape enregistrée pour cette tentative.
                  </p>
                ) : (
                  stepLogs.map((step) => {
                    const isSuccess = step.status === 'success';
                    const isFailed = step.status === 'failed';
                    const stepTitle = 
                      step.stepName === 'wedof_fetch' ? 'Récupération Wedof' :
                      step.stepName === 'pennylane_customer' ? 'Création client Pennylane' :
                      step.stepName === 'pennylane_invoice' ? 'Création facture Pennylane' :
                      step.stepName === 'wedof_notify' ? 'Notification Wedof Billed' :
                      step.stepName === 'wedof_notify_service_done' || step.stepName === 'wedof_service_done' ? 'Déclaration Service Fait' :
                      step.stepName === 'supabase_update' ? 'Mise à jour veritabanı' : step.stepName;

                    return (
                      <div key={step.id} className="relative pl-7 space-y-1">
                        {/* Dot indicator */}
                        <div className={`absolute left-1.5 top-1 h-3 w-3 rounded-full border-2 ${
                          isSuccess ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/20' :
                          isFailed ? 'bg-red-500 border-red-500 shadow-sm shadow-red-500/20' :
                          'bg-zinc-950 border-zinc-700'
                        }`} />

                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-200">{stepTitle}</span>
                          <span className="text-[10px] text-zinc-500 font-mono font-semibold">{step.durationMs}ms</span>
                        </div>

                        {step.errorMessage && (
                          <div className="flex gap-1.5 text-[11px] text-red-400 font-semibold bg-red-950/10 rounded-lg p-2.5 border border-red-950/20 mt-1 whitespace-pre-wrap">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{step.errorMessage}</span>
                          </div>
                        )}
                        
                        {/* Inline brief data snippets */}
                        {isSuccess && step.stepName === 'pennylane_invoice' && step.outputData?.invoice_number && (
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                            <CornerDownRight className="h-3 w-3 text-zinc-650" />
                            <span>N° Facture créé: <span className="text-zinc-200 font-bold">{step.outputData.invoice_number}</span></span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
