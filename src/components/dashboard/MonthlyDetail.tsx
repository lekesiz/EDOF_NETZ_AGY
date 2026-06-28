'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Calendar, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DossierDetail {
  id: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  training_title: string | null;
  start_date: string | null;
  end_date: string | null;
  wedof_status: string | null;
  amount: number;
  is_reconciled: boolean;
  pennylane_invoice_number: string | null;
  vade_tarihi: string | null;
  kategori: 'kasa' | 'alacak' | 'kayip';
}

interface DailyData {
  date: string;
  kasa: number;
  alacak: number;
  kayip: number;
  count: number;
  total: number;
}

interface MonthlyDetailData {
  month: string;
  vadeGun: number;
  totals: {
    kasa: number;
    alacak: number;
    kayip: number;
    total: number;
    count: number;
  };
  dailyData: DailyData[];
  dossiers: DossierDetail[];
}

interface MonthlyDetailProps {
  month: string;
  onClose: () => void;
}

const KATEGORI_COLORS = {
  kasa: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', label: 'ENCAISSÉ' },
  alacak: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', label: 'EN ATTENTE' },
  kayip: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', label: 'ANNULÉ' },
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
  '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
  '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
};

export function MonthlyDetail({ month, onClose }: MonthlyDetailProps) {
  const [data, setData] = useState<MonthlyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'kasa' | 'alacak' | 'kayip'>('all');

  const [yearStr, monthStr] = month.split('-');
  const monthName = MONTH_NAMES[monthStr] || monthStr;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard/monthly?month=${month}`);
        if (!res.ok) throw new Error('Impossible de charger les données');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [month]);

  // Filter dossiers
  const filteredDossiers = data?.dossiers.filter(
    (d) => filter === 'all' || d.kategori === filter
  ) || [];

  // Group filtered dossiers by day
  const dossiersByDay: Record<string, DossierDetail[]> = {};
  for (const d of filteredDossiers) {
    const day = d.vade_tarihi || 'unknown';
    if (!dossiersByDay[day]) dossiersByDay[day] = [];
    dossiersByDay[day].push(d);
  }

  const sortedDays = Object.keys(dossiersByDay).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 pt-10 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-zinc-100">{monthName} {yearStr} - Vue détaillée</h2>
              <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Détail journalier de la trésorerie</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-800 border-t-blue-500" />
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-red-400 text-sm font-semibold">{error}</div>
        )}

        {data && !loading && (
          <div className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-850 bg-zinc-900/20 p-4 text-center">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total (h. a.)</p>
                <p className="mt-1 text-lg font-bold text-zinc-100">{formatCurrency(data.totals.total)}</p>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">{data.totals.count} dossiers</p>
              </div>
              <div className="rounded-xl border border-emerald-950 bg-emerald-950/10 p-4 text-center">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">ENCAISSÉ</p>
                <p className="mt-1 text-lg font-bold text-emerald-400">{formatCurrency(data.totals.kasa)}</p>
              </div>
              <div className="rounded-xl border border-amber-950 bg-amber-950/10 p-4 text-center">
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">EN ATTENTE</p>
                <p className="mt-1 text-lg font-bold text-amber-500">{formatCurrency(data.totals.alacak)}</p>
              </div>
              <div className="rounded-xl border border-red-950 bg-red-950/10 p-4 text-center">
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">ANNULÉ</p>
                <p className="mt-1 text-lg font-bold text-red-400">{formatCurrency(data.totals.kayip)}</p>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wider mr-2">Filtrer par :</span>
              {(['all', 'kasa', 'alacak', 'kayip'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 font-bold transition-all duration-200 border ${
                    filter === f
                      ? f === 'all'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/10'
                        : f === 'kasa'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                        : f === 'alacak'
                        ? 'bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-red-600 border-red-500 text-white shadow-md shadow-red-500/10'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f === 'all' ? 'TOUS' : f === 'kasa' ? 'ENCAISSÉ' : f === 'alacak' ? 'EN ATTENTE' : 'ANNULÉ'}
                  {f !== 'all' && (
                    <span className="ml-1 text-[10px] opacity-80">
                      ({data.dossiers.filter(d => d.kategori === f).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Daily Breakdown */}
            <div className="space-y-3">
              {sortedDays.map((day) => {
                const dayDossiers = dossiersByDay[day];
                const dayTotal = dayDossiers.filter(d => d.kategori !== 'kayip').reduce((s, d) => s + (d.amount || 0), 0);
                const isExpanded = expandedDay === day;
                const dayDate = new Date(day);
                const dayName = dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <div key={day} className="rounded-xl border border-zinc-800/80 bg-zinc-900/10 overflow-hidden">
                    {/* Day Header - Clickable */}
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day)}
                      className="flex w-full items-center justify-between bg-zinc-900/30 px-4 py-3 hover:bg-zinc-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15 border border-blue-500/20 text-blue-400 font-bold text-sm">
                          {dayDate.getDate()}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-zinc-200">{dayName}</p>
                          <p className="text-[10px] text-zinc-500 font-semibold">{dayDossiers.length} dossiers</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Mini category badges */}
                        <div className="hidden sm:flex items-center gap-2">
                          {dayDossiers.some(d => d.kategori === 'kasa') && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              {formatCurrency(dayDossiers.filter(d => d.kategori === 'kasa').reduce((s, d) => s + (d.amount || 0), 0))}
                            </span>
                          )}
                          {dayDossiers.some(d => d.kategori === 'alacak') && (
                            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              {formatCurrency(dayDossiers.filter(d => d.kategori === 'alacak').reduce((s, d) => s + (d.amount || 0), 0))}
                            </span>
                          )}
                          {dayDossiers.some(d => d.kategori === 'kayip') && (
                            <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                              {formatCurrency(dayDossiers.filter(d => d.kategori === 'kayip').reduce((s, d) => s + (d.amount || 0), 0))}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-zinc-100">{formatCurrency(dayTotal)}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Dossier List */}
                    {isExpanded && (
                      <div className="divide-y divide-zinc-800/40 border-t border-zinc-800/60 bg-black/10">
                        {dayDossiers.map((d) => {
                          const cat = KATEGORI_COLORS[d.kategori];
                          return (
                            <div key={d.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-900/20 transition-colors group">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cat.bg} ${cat.text} ${cat.border}`}>
                                  {cat.label}
                                </span>
                                <div className="min-w-0">
                                  <Link href={`/dossiers/${d.id}`} className="text-sm font-semibold text-zinc-200 hover:text-blue-400 truncate inline-flex items-center gap-1.5">
                                    <span>{d.first_name} {d.last_name}</span>
                                    <ExternalLink className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </Link>
                                  <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">
                                    {d.training_title || "Pas de titre de formation"}
                                  </p>
                                  <p className="text-[10px] text-zinc-500 font-semibold mt-0.5 uppercase tracking-wide">
                                    Fin: {d.end_date || '-'} | Échéance: {d.vade_tarihi || '-'}
                                    {d.wedof_status && (
                                      <span className="ml-2 text-zinc-600">({d.wedof_status})</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <p className={`text-sm font-bold ${cat.text}`}>
                                  {formatCurrency(d.amount || 0)}
                                </p>
                                <div className="flex items-center gap-1.5 justify-end mt-0.5 text-[10px] font-semibold uppercase tracking-wider">
                                  {d.is_reconciled ? (
                                    <span className="text-emerald-400">Rapproché</span>
                                  ) : (
                                    <span className="text-zinc-600">Non rapp.</span>
                                  )}
                                  {d.pennylane_invoice_number && (
                                    <span className="text-blue-400 border border-blue-500/20 bg-blue-500/10 px-1 rounded">#{d.pennylane_invoice_number}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {sortedDays.length === 0 && (
                <div className="py-12 text-center text-xs text-zinc-500 font-bold uppercase tracking-wider">
                  Aucune donnée trouvée pour ce filtre.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
