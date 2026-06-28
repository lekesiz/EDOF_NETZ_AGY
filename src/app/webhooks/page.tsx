'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Terminal,
  AlertCircle
} from 'lucide-react';

interface WebhookLog {
  id: string;
  webhookType: string;
  event: string | null;
  externalId: string | null;
  status: string;
  payload: any;
  headers: any;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

export default function WebhooksPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setOffset(0); // Reset page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLogs = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    setError(null);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const queryParam = debouncedQuery ? `&query=${encodeURIComponent(debouncedQuery)}` : '';
      
      const res = await fetch(`/api/webhooks?limit=${limit}&offset=${offset}${statusParam}${queryParam}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Échec de la récupération des logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, statusFilter, debouncedQuery]);

  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const toggleDetails = (id: string) => {
    setSelectedLogId(selectedLogId === id ? null : id);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400 animate-pulse" />
            <span>Journal des Webhooks</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Suivi en temps réel et diagnostic des requêtes entrantes de la plateforme WEDOF
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={isRefreshing}
          className="rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 hover:text-zinc-100 px-4 py-2 text-xs font-bold text-zinc-300 transition-all flex items-center gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Rafraîchir</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-900/30 bg-red-950/10 p-4 text-sm text-red-400 font-medium">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shrink-0 w-full md:w-auto">
          {(['all', 'success', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setOffset(0);
              }}
              className={`flex-1 md:flex-initial rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                statusFilter === status
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {status === 'all' && 'Tous'}
              {status === 'success' && 'Succès'}
              {status === 'failed' && 'Échecs'}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Rechercher par ID dossier, événement, erreur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs text-zinc-300 premium-input transition-all rounded-xl"
          />
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 glass-card overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs font-semibold uppercase tracking-wider space-y-4">
            <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin mx-auto" />
            <p>Chargement des webhooks...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-wider space-y-2">
            <Terminal className="h-8 w-8 text-zinc-650 mx-auto" />
            <p>Aucun log de webhook trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <th className="py-4 px-6">Statut</th>
                  <th className="py-4 px-6">Événement</th>
                  <th className="py-4 px-6">Dossier</th>
                  <th className="py-4 px-6">Durée</th>
                  <th className="py-4 px-6">Date de réception</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60 text-xs font-semibold text-zinc-300">
                {logs.map((log) => {
                  const isExpanded = selectedLogId === log.id;
                  const isSuccess = log.status === 'success';
                  
                  return (
                    <>
                      <tr 
                        key={log.id} 
                        className="hover:bg-zinc-900/30 transition-colors duration-150 cursor-pointer"
                        onClick={() => toggleDetails(log.id)}
                      >
                        {/* Status Badge */}
                        <td className="py-4 px-6">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Succès</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase text-red-400 border border-red-500/20">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Échec</span>
                            </span>
                          )}
                        </td>

                        {/* Event Name */}
                        <td className="py-4 px-6 font-mono text-[11px] text-zinc-400">
                          {log.event || 'inconnu'}
                        </td>

                        {/* Dossier External ID */}
                        <td className="py-4 px-6 font-mono text-[11px] text-zinc-200">
                          {log.externalId || '—'}
                        </td>

                        {/* Duration */}
                        <td className="py-4 px-6 text-zinc-400 font-medium">
                          {log.durationMs !== null ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-zinc-650" />
                              <span>{log.durationMs} ms</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-4 px-6 text-zinc-400">
                          {new Date(log.createdAt).toLocaleString('fr-FR')}
                        </td>

                        {/* Arrow Collapse Action */}
                        <td className="py-4 px-6 text-right">
                          <button className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Collapsible Inspection Panel */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-zinc-950/60 p-6 border-y border-zinc-900/80">
                            <div className="space-y-4">
                              {/* Error Info if failed */}
                              {log.errorMessage && (
                                <div className="rounded-xl border border-red-900/30 bg-red-950/15 p-4 space-y-1">
                                  <h4 className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest">Message d'erreur</h4>
                                  <p className="text-xs font-bold text-red-300 font-mono break-all">{log.errorMessage}</p>
                                </div>
                              )}

                              {/* Headers and Payload Grid */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Headers Container */}
                                <div className="space-y-1.5">
                                  <h4 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Terminal className="h-3.5 w-3.5 text-zinc-600" />
                                    <span>Headers de la Requête</span>
                                  </h4>
                                  <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 max-h-[300px] overflow-y-auto text-[11px] font-mono text-zinc-400 scrollbar-thin">
                                    <pre className="whitespace-pre-wrap word-break">
                                      {JSON.stringify(log.headers, null, 2)}
                                    </pre>
                                  </div>
                                </div>

                                {/* Payload Container */}
                                <div className="space-y-1.5">
                                  <h4 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Terminal className="h-3.5 w-3.5 text-zinc-600" />
                                    <span>Payload JSON</span>
                                  </h4>
                                  <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 max-h-[300px] overflow-y-auto text-[11px] font-mono text-zinc-400 scrollbar-thin">
                                    <pre className="whitespace-pre-wrap word-break">
                                      {JSON.stringify(log.payload, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {total > 0 && (
          <div className="border-t border-zinc-900/60 bg-zinc-950/40 px-6 py-4 flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span>
              Affichage de <span className="text-zinc-350">{offset + 1}</span> à{' '}
              <span className="text-zinc-350">{Math.min(offset + limit, total)}</span> sur{' '}
              <span className="text-zinc-350">{total}</span> webhooks
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="rounded-lg bg-zinc-900 border border-zinc-850 px-3.5 py-2 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Précédent
              </button>
              <button
                onClick={handleNextPage}
                disabled={offset + limit >= total}
                className="rounded-lg bg-zinc-900 border border-zinc-850 px-3.5 py-2 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
