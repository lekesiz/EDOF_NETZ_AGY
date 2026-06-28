'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  Clock, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  XCircle, 
  AlertCircle,
  Inbox,
  History
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EmailLogItem {
  id: string;
  dossier_id: string | null;
  email: string;
  email_type: string;
  resend_id: string | null;
  sent_at: string;
}

interface QueueItem {
  id: string;
  dossier_id: string | null;
  email: string;
  email_type: string;
  status: string;
  error_message: string | null;
  scheduled_for: string;
  created_at: string;
  sent_at: string | null;
  firstName: string | null;
  lastName: string | null;
  trainingTitle: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<'history' | 'queue'>('queue');
  
  // Sent Logs State
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [logsPagination, setLogsPagination] = useState<Pagination | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsTypeFilter, setLogsTypeFilter] = useState('all');

  // Queue State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch Sent Logs
  const fetchEmailLogs = async () => {
    setLogsLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(logsPage),
        limit: '20',
      });
      if (logsSearch.trim()) {
        query.set('search', logsSearch);
      }
      if (logsTypeFilter !== 'all') {
        query.set('type', logsTypeFilter);
      }
      
      const res = await fetch(`/api/emails?${query.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Échec du chargement de l\'historique des e-mails');
      const data = await res.json();
      setLogs(data.logs);
      setLogsPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch Queue
  const fetchQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await fetch('/api/emails/queue', { cache: 'no-store' });
      if (!res.ok) throw new Error('Échec du chargement de la file d\'attente');
      const data = await res.json();
      setQueue(data.queue);
    } catch (err: any) {
      console.error(err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchEmailLogs();
    } else {
      fetchQueue();
    }
  }, [activeTab, logsPage, logsTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLogsPage(1);
    fetchEmailLogs();
  };

  // Handle Queue actions
  const handleQueueAction = async (id: string, action: 'approve' | 'cancel') => {
    setActioningId(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/emails/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Une erreur est survenue lors de l\'action');

      setActionSuccess(
        action === 'approve' 
          ? 'E-mail approuvé et envoyé avec succès !' 
          : 'E-mail annulé avec succès.'
      );
      
      // Refresh queue
      await fetchQueue();
    } catch (err: any) {
      setActionError(err.message || 'Une erreur est survenue');
    } finally {
      setActioningId(null);
    }
  };

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case 'bday':
        return '🎂 Anniversaire';
      case 'survey1':
        return '📝 Enquête J+1';
      case 'survey6':
        return '📝 Enquête M+6';
      default:
        return type;
    }
  };

  const getEmailTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'bday':
        return 'bg-pink-500/10 text-pink-400 border border-pink-500/25';
      case 'survey1':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
      case 'survey6':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/25';
      default:
        return 'bg-zinc-800 text-zinc-400';
    }
  };

  const getQueueStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'sent':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'cancelled':
        return 'bg-zinc-800 text-zinc-500 border border-zinc-700/50';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse';
      default:
        return 'bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            <span>Communications Clients</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Gérez la file d'attente d'envoi et consultez l'historique des emails de satisfaction & anniversaires.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex bg-zinc-900 border border-zinc-800/80 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'queue'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Inbox className="h-4 w-4" />
            File d'attente
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="h-4 w-4" />
            Historique
          </button>
        </div>
      </div>

      {/* Action alerts */}
      {actionError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-950/40 border border-red-500/20 text-red-200 text-xs">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ── TAB 1: OUTBOX QUEUE ────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 glass-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="px-6 py-4">Apprenant</th>
                    <th className="px-6 py-4">Destinataire (E-mail)</th>
                    <th className="px-6 py-4">Type de message</th>
                    <th className="px-6 py-4">Date de planification</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-sm">
                  {queueLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 font-semibold animate-pulse">
                        Chargement de la file d'attente...
                      </td>
                    </tr>
                  ) : queue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 font-semibold">
                        Aucun e-mail en attente d'approbation aujourd'hui.
                      </td>
                    </tr>
                  ) : (
                    queue.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="px-6 py-4 font-bold text-zinc-200">
                          {item.firstName || item.lastName ? (
                            <div>
                              <span>{item.lastName} {item.firstName}</span>
                              {item.trainingTitle && (
                                <p className="text-[10px] text-zinc-550 font-semibold truncate max-w-xs mt-0.5">
                                  {item.trainingTitle}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-350">{item.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-bold ${getEmailTypeBadgeClass(item.email_type)}`}>
                            {getEmailTypeLabel(item.email_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-400 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-zinc-600" />
                            {format(parseISO(item.scheduled_for), 'dd MMMM yyyy', { locale: fr })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${getQueueStatusBadgeClass(item.status)}`}>
                            {item.status === 'pending' ? 'En attente' : item.status === 'sent' ? 'Envoyé' : item.status === 'cancelled' ? 'Annulé' : 'Échoué'}
                          </span>
                          {item.error_message && (
                            <p className="text-[10px] text-red-400 mt-1 max-w-xs truncate" title={item.error_message}>
                              Error: {item.error_message}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {(item.status === 'pending' || item.status === 'failed') && (
                              <>
                                <button
                                  onClick={() => handleQueueAction(item.id, 'approve')}
                                  disabled={actioningId !== null}
                                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 shadow-sm transition-all"
                                  title="Approuver et envoyer"
                                >
                                  {actioningId === item.id ? (
                                    <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <Send className="h-3 w-3" />
                                  )}
                                  Envoyer
                                </button>
                                <button
                                  onClick={() => handleQueueAction(item.id, 'cancel')}
                                  disabled={actioningId !== null}
                                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 transition-all"
                                  title="Annuler le message"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Annuler
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: EMAIL HISTORY ───────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Rechercher par e-mail..."
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 pl-4 pr-10 py-2.5 text-sm text-zinc-250 placeholder-zinc-650 focus:border-zinc-700 focus:outline-none transition-all premium-input"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>

            <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800 p-1 rounded-xl w-fit">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'bday', label: 'Anniversaires' },
                { id: 'survey1', label: 'Enquêtes J+1' },
                { id: 'survey6', label: 'Enquêtes M+6' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setLogsTypeFilter(type.id);
                    setLogsPage(1);
                  }}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    logsTypeFilter === type.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 glass-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="px-6 py-4">Destinataire (E-mail)</th>
                    <th className="px-6 py-4">Type de communication</th>
                    <th className="px-6 py-4">ID de transaction (Resend)</th>
                    <th className="px-6 py-4">Date & Heure d'envoi</th>
                    <th className="px-6 py-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-sm">
                  {logsLoading && logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 font-semibold animate-pulse">
                        Chargement de l'historique...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 font-semibold">
                        Aucun e-mail envoyé ne correspond aux critères.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="px-6 py-4 font-bold text-zinc-200">{log.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-bold ${getEmailTypeBadgeClass(log.email_type)}`}>
                            {getEmailTypeLabel(log.email_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-zinc-550 font-semibold">
                          {log.resend_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-400 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-zinc-650" />
                            {format(parseISO(log.sent_at), 'dd MMMM yyyy HH:mm:ss', { locale: fr })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            Envoyé
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logsPagination && logsPagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/20 px-6 py-4">
                <span className="text-xs text-zinc-500 font-semibold">
                  Page {logsPagination.page} sur {logsPagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                    disabled={logsPage <= 1}
                    className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setLogsPage(p => Math.min(logsPagination.totalPages, p + 1))}
                    disabled={logsPage >= logsPagination.totalPages}
                    className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
