'use client';

import { useEffect, useState } from 'react';
import { DashboardSkeleton } from '@/components/LoadingSkeleton';
import { Wallet, Clock, XCircle, BarChart3 } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { MonthlyDetail } from '@/components/dashboard/MonthlyDetail';
import { SyncStatus } from '@/components/dashboard/SyncStatus';
import { formatCurrency } from '@/lib/utils';
import type { DashboardResponse } from '@/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard?year=${year}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [year]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-6 text-center max-w-sm w-full">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, monthlyData, lastSync } = data;

  const enAttente = stats.invoicedPending;
  const caRealise = stats.kasa + enAttente;
  const objectifCA = stats.targetAmount || 0;
  const restant = objectifCA - caRealise;
  const tauxRealisation = objectifCA > 0 ? ((caRealise / objectifCA) * 100) : 0;
  const ratioEncaisse = objectifCA > 0 ? ((stats.kasa / objectifCA) * 100) : 0;
  const ratioEnAttente = objectifCA > 0 ? ((enAttente / objectifCA) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Monthly Detail Modal */}
      {selectedMonth && (
        <MonthlyDetail
          month={selectedMonth}
          onClose={() => setSelectedMonth(null)}
        />
      )}

      {/* Year Selector & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Rapport financier {year}</h2>
          <p className="mt-1 text-xs text-zinc-500 font-semibold uppercase tracking-wider">
            {stats.totalDossiers} dossiers enregistrés au total
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setYear(year - 1)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
          >
            {year - 1}
          </button>
          <span className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-500/10">
            {year}
          </span>
          <button
            onClick={() => setYear(year + 1)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
          >
            {year + 1}
          </button>
        </div>
      </div>

      {/* Top Banner - Target & Progress */}
      <div className="rounded-2xl bg-gradient-to-tr from-zinc-900 via-zinc-900 to-zinc-850 border border-zinc-800 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <BarChart3 className="h-44 w-44 text-white" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Objectif */}
          <div className="text-center md:text-left border-b md:border-b-0 md:border-r border-zinc-800 pb-4 md:pb-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Objectif CA {year}</p>
            <p className="mt-1 text-3xl font-extrabold text-zinc-100 tracking-tight">{formatCurrency(objectifCA)}</p>
          </div>
          {/* Réalisé */}
          <div className="text-center md:text-left border-b md:border-b-0 md:border-r border-zinc-800 pb-4 md:pb-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Réalisé (Encaissé + En attente)</p>
            <p className="mt-1 text-3xl font-extrabold text-emerald-400 tracking-tight">{formatCurrency(caRealise)}</p>
          </div>
          {/* Restant */}
          <div className="text-center md:text-left">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              {restant > 0 ? 'Objectif restant' : 'Objectif dépassé'}
            </p>
            <p className={`mt-1 text-3xl font-extrabold tracking-tight ${restant > 0 ? 'text-amber-500' : 'text-emerald-400'}`}>
              {restant > 0 ? formatCurrency(restant) : `+${formatCurrency(Math.abs(restant))}`}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 border-t border-zinc-800/50 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] font-semibold text-zinc-400 mb-2">
            <span>Encaissé: <span className="text-emerald-400">{formatCurrency(stats.kasa)}</span> ({ratioEncaisse.toFixed(1)}%)</span>
            <span>En attente: <span className="text-amber-500">{formatCurrency(enAttente)}</span> ({ratioEnAttente.toFixed(1)}%)</span>
            <span className="text-zinc-300">Taux de réalisation: {tauxRealisation.toFixed(1)}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden flex">
            {/* Encaissé bar */}
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(ratioEncaisse, 100)}%`,
                background: 'linear-gradient(90deg, #10b981, #34d399)',
              }}
            />
            {/* En attente bar */}
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(ratioEnAttente, 100 - Math.min(ratioEncaisse, 100))}%`,
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 
              <span className="text-zinc-500">Encaissé (Échu)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500" /> 
              <span className="text-zinc-500">En attente (À venir)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Previous Year Tracker */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total clôturé l'année précédente ({year - 1})</span>
        <span className="text-sm font-bold text-zinc-300">{formatCurrency(stats.previousYearTotal)}</span>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Encaissé (Échu)"
          value={stats.kasa}
          icon={Wallet}
          color="text-emerald-400"
          bgColor="bg-emerald-500/10 border-emerald-500/20"
          subtitle="Montants validés & encaissés"
        />
        <StatCard
          title="En attente (À venir)"
          value={enAttente}
          icon={Clock}
          color="text-amber-500"
          bgColor="bg-amber-500/10 border-amber-500/20"
          subtitle="Projets en cours de validation"
        />
        <StatCard
          title="Annulé / Perdu"
          value={stats.kayip}
          icon={XCircle}
          color="text-red-400"
          bgColor="bg-red-500/10 border-red-500/20"
          subtitle="Dossiers annulés ou rejetés"
        />
      </div>

      {/* Chart & Sync Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <MonthlyChart
            data={monthlyData}
            year={year}
            onMonthClick={(month) => setSelectedMonth(month)}
          />
        </div>
        <div className="space-y-6">
          <SyncStatus
            lastWedofSync={lastSync.wedof}
            lastPennylaneSync={lastSync.pennylane}
          />
          
          {/* Summary Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5">
            <h3 className="mb-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Résumé de l'activité</h3>
            <div className="space-y-3.5 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-wide">Total dossiers</span>
                <span className="text-zinc-200">{stats.totalDossiers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-wide">Rapprochés (bank)</span>
                <span className="text-emerald-400">{stats.reconciledCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-wide">Taux d'encaissement</span>
                <span className="text-blue-400">
                  {caRealise > 0 ? ((stats.kasa / caRealise) * 100).toFixed(1) : 0}%
                </span>
              </div>
              
              <hr className="border-zinc-800/80 my-2" />
              
              <div className="flex justify-between">
                <span className="text-zinc-400 font-bold uppercase tracking-wide">Objectif</span>
                <span className="text-zinc-200 font-bold">{formatCurrency(objectifCA)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-wide">Encaissé</span>
                <span className="text-emerald-400">{formatCurrency(stats.kasa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-wide">En attente</span>
                <span className="text-amber-500">{formatCurrency(enAttente)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-wide">Annulé</span>
                <span className="text-red-400">{formatCurrency(stats.kayip)}</span>
              </div>
              
              <hr className="border-zinc-800/80 my-2" />
              
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-bold uppercase tracking-wide">Restant</span>
                <span className={`text-xs font-extrabold ${restant > 0 ? 'text-amber-500' : 'text-emerald-400'}`}>
                  {restant > 0 ? formatCurrency(restant) : 'Objectif dépassé !'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
