'use client';

import { useState, useEffect } from 'react';
import { Mail, Search, Clock, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function EmailsPage() {
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchEmailLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '25',
      });
      if (search.trim()) {
        query.set('search', search);
      }
      if (typeFilter !== 'all') {
        query.set('type', typeFilter);
      }
      
      const res = await fetch(`/api/emails?${query.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Échec du chargement de l\'historique des emails');
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
    fetchEmailLogs();
  }, [page, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEmailLogs();
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

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-500" />
          <span>Communications E-mails</span>
        </h2>
        <p className="mt-1 text-xs text-zinc-500 font-medium">
          Historique des e-mails automatiques envoyés (anniversaires et enquêtes de satisfaction) via Resend API
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
          <input
            type="text"
            placeholder="Rechercher par e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 pl-4 pr-10 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none transition-all"
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
                setTypeFilter(type.id);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                typeFilter === type.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-4">Destinataire (E-mail)</th>
                <th className="px-6 py-4">Type de communication</th>
                <th className="px-6 py-4">ID de transaction (Resend)</th>
                <th className="px-6 py-4">Date & Heure d'envoi</th>
                <th className="px-6 py-4">Statut de délivrabilité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-sm">
              {loading && logs.length === 0 ? (
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
                    <td className="px-6 py-4 font-bold text-zinc-200">
                      {log.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-bold ${getEmailTypeBadgeClass(log.email_type)}`}>
                        {getEmailTypeLabel(log.email_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-500 font-semibold">
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
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/20 px-6 py-4">
            <span className="text-xs text-zinc-500 font-semibold">
              Page {pagination.page} sur {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
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
