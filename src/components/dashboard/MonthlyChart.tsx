'use client';

import { useMemo, useState } from 'react';
import type { MonthlyData } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface MonthlyChartProps {
  data: MonthlyData[];
  year: number;
  onMonthClick?: (month: string) => void;
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
  '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Août',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

const CHART_HEIGHT = 280; // pixels

export function MonthlyChart({ data, year, onMonthClick }: MonthlyChartProps) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');

  const chartData = useMemo(() => {
    return data.map((d) => {
      const monthParts = d.month.split('-');
      const monthNum = monthParts[1] || '01';
      const monthKey = `${year}-${monthNum}`;
      const kasa = Number(d.kasa) || 0;
      const alacak = Number(d.alacak) || 0;
      const kayip = Number(d.kayip) || 0;
      return {
        month: monthKey,
        monthNum,
        label: MONTH_LABELS[monthNum] || monthNum,
        kasa,
        alacak,
        kayip,
        total: kasa + alacak,
      };
    });
  }, [data, year]);

  const maxTotal = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.kasa + d.alacak + d.kayip), 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }, [chartData]);

  const yTicks = useMemo(() => {
    const ticks = [];
    const step = maxTotal / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round(step * i));
    }
    return ticks;
  }, [maxTotal]);

  const grandTotals = useMemo(() => {
    return chartData.reduce(
      (acc, d) => ({
        kasa: acc.kasa + d.kasa,
        alacak: acc.alacak + d.alacak,
        kayip: acc.kayip + d.kayip,
        total: acc.total + d.total,
      }),
      { kasa: 0, alacak: 0, kayip: 0, total: 0 }
    );
  }, [chartData]);

  const formatShort = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M €`;
    if (v >= 1000) return `${Math.round(v / 1000)}k €`;
    return `${v} €`;
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 glass-card shadow-lg shadow-black/40">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-850 px-6 py-4">
        <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">
          Projection de trésorerie {year}
        </h3>
        <div className="flex gap-1 rounded-xl bg-zinc-950/80 border border-zinc-850 p-1">
          <button
            onClick={() => setActiveTab('chart')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-300 ${
              activeTab === 'chart'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Graphique
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-300 ${
              activeTab === 'table'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tableau
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-6 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Encaissé (Échu)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">En attente (À venir)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Annulé / Refusé</span>
        </div>
      </div>

      {activeTab === 'chart' ? (
        /* ===== CHART TAB ===== */
        <div className="px-6 pb-6">
          <div style={{ display: 'flex', height: CHART_HEIGHT + 32 }}>
            {/* Y-axis labels */}
            <div style={{ width: 60, height: CHART_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'right', paddingRight: 8 }}>
              {yTicks.slice().reverse().map((tick, i) => (
                <span key={i} className="text-[10px] text-zinc-500 font-semibold leading-none">
                  {formatShort(tick)}
                </span>
              ))}
            </div>

            {/* Chart area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Bars container */}
              <div style={{ position: 'relative', height: CHART_HEIGHT, borderLeft: '1px solid #27272a', borderBottom: '1px solid #27272a' }}>
                {/* Horizontal grid lines */}
                {yTicks.slice(1).reverse().map((tick, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: `${(tick / maxTotal) * 100}%`,
                      borderTop: '1px dashed rgba(255, 255, 255, 0.05)',
                    }}
                  />
                ))}

                {/* Bars - positioned absolutely at bottom */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  top: 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-around',
                  padding: '0 4px',
                }}>
                  {chartData.map((d) => {
                    const barTotal = d.kasa + d.alacak + d.kayip;
                    const totalPx = maxTotal > 0 ? (barTotal / maxTotal) * CHART_HEIGHT : 0;
                    const kasaPx = barTotal > 0 ? (d.kasa / barTotal) * totalPx : 0;
                    const alacakPx = barTotal > 0 ? (d.alacak / barTotal) * totalPx : 0;
                    const kayipPx = barTotal > 0 ? (d.kayip / barTotal) * totalPx : 0;
                    const isHovered = hoveredMonth === d.month;

                    return (
                      <div
                        key={d.month}
                        style={{
                          width: `${100 / 12}%`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setHoveredMonth(d.month)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        onClick={() => onMonthClick?.(d.month)}
                      >
                        {/* Tooltip */}
                        {isHovered && d.total > 0 && (
                          <div className="absolute rounded-xl border border-zinc-800 bg-zinc-950/85 backdrop-blur-xl p-4 shadow-2xl select-none z-20 whitespace-nowrap min-w-[210px] shadow-black/90 transition-all duration-300" style={{
                            bottom: totalPx + 12,
                          }}>
                            <p className="font-extrabold text-zinc-100 text-xs mb-2.5 tracking-wider uppercase">{d.label} {year}</p>
                            <div className="space-y-1.5">
                              {d.kasa > 0 && (
                                <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>Encaissé: {formatCurrency(d.kasa)}</span>
                                </p>
                              )}
                              {d.alacak > 0 && (
                                <p className="text-[11px] font-bold text-amber-500 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>En attente: {formatCurrency(d.alacak)}</span>
                                </p>
                              )}
                              {d.kayip > 0 && (
                                <p className="text-[11px] font-bold text-red-400 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  <span>Annulé: {formatCurrency(d.kayip)}</span>
                                </p>
                              )}
                            </div>
                            <hr className="my-2.5 border-zinc-800" />
                            <p className="text-xs font-extrabold text-zinc-200">
                              Total (h. a.) : {formatCurrency(d.total)}
                            </p>
                            <p className="text-[10px] text-blue-400 font-bold mt-2 animate-pulse tracking-wide">Cliquez pour le détail →</p>
                          </div>
                        )}

                        {/* Stacked bar using pixel heights with linear gradients */}
                        <div style={{
                          width: 28,
                          borderRadius: '6px 6px 0 0',
                          overflow: 'hidden',
                          opacity: isHovered ? 0.9 : 1,
                          transform: isHovered ? 'scale(1.08) translateY(-2px)' : 'scale(1) translateY(0)',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: isHovered ? '0 0 15px rgba(59, 130, 246, 0.25)' : 'none',
                        }}>
                          {/* Kayip (top) - red gradient */}
                          {kayipPx > 0 && (
                            <div style={{
                              height: Math.max(kayipPx, 2),
                              background: 'linear-gradient(180deg, #ef4444 0%, #991b1b 100%)',
                            }} />
                          )}
                          {/* Alacak (middle) - amber gradient */}
                          {alacakPx > 0 && (
                            <div style={{
                              height: Math.max(alacakPx, 2),
                              background: 'linear-gradient(180deg, #f59e0b 0%, #92400e 100%)',
                            }} />
                          )}
                          {/* Kasa (bottom) - emerald gradient */}
                          {kasaPx > 0 && (
                            <div style={{
                              height: Math.max(kasaPx, 2),
                              background: 'linear-gradient(180deg, #10b981 0%, #065f46 100%)',
                            }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* X-axis labels */}
              <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 8 }}>
                {chartData.map((d) => (
                  <div
                    key={d.month}
                    style={{ width: `${100 / 12}%`, textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => onMonthClick?.(d.month)}
                  >
                    <span className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-zinc-500 font-semibold">
            Cliquez sur un mois pour voir le détail quotidien
          </p>
        </div>
      ) : (
        /* ===== TABLE TAB ===== */
        <div className="px-6 pb-6 pt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-3 font-bold text-zinc-400 uppercase tracking-wider">Mois</th>
                  <th className="py-3 text-right font-bold text-emerald-400 uppercase tracking-wider">ENCAISSÉ</th>
                  <th className="py-3 text-right font-bold text-amber-500 uppercase tracking-wider">EN ATTENTE</th>
                  <th className="py-3 text-right font-bold text-red-500 uppercase tracking-wider">ANNULÉ</th>
                  <th className="py-3 text-right font-bold text-zinc-300 uppercase tracking-wider">TOTAL (h. a.)</th>
                  <th className="py-3 text-center font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {chartData.map((d) => (
                  <tr
                    key={d.month}
                    className="hover:bg-zinc-900/30 transition-colors cursor-pointer"
                    onClick={() => onMonthClick?.(d.month)}
                  >
                    <td className="py-3 font-semibold text-zinc-200">
                      {d.label} {year}
                    </td>
                    <td className="py-3 text-right font-semibold text-emerald-400">
                      {d.kasa > 0 ? formatCurrency(d.kasa) : <span className="text-zinc-700">-</span>}
                    </td>
                    <td className="py-3 text-right font-semibold text-amber-500">
                      {d.alacak > 0 ? formatCurrency(d.alacak) : <span className="text-zinc-700">-</span>}
                    </td>
                    <td className="py-3 text-right font-semibold text-red-500">
                      {d.kayip > 0 ? formatCurrency(d.kayip) : <span className="text-zinc-700">-</span>}
                    </td>
                    <td className="py-3 text-right font-bold text-zinc-100">
                      {d.total > 0 ? formatCurrency(d.total) : <span className="text-zinc-700">-</span>}
                    </td>
                    <td className="py-3 text-center">
                      {(d.kasa + d.alacak + d.kayip) > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMonthClick?.(d.month);
                          }}
                          className="rounded-md bg-blue-600/10 border border-blue-500/20 px-3 py-1 text-[10px] font-bold text-blue-400 hover:bg-blue-600/20 transition-colors"
                        >
                          Détails
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-800 bg-zinc-950/20">
                  <td className="py-3.5 font-bold text-zinc-300">TOTAL</td>
                  <td className="py-3.5 text-right font-bold text-emerald-400">{formatCurrency(grandTotals.kasa)}</td>
                  <td className="py-3.5 text-right font-bold text-amber-500">{formatCurrency(grandTotals.alacak)}</td>
                  <td className="py-3.5 text-right font-bold text-red-500">{formatCurrency(grandTotals.kayip)}</td>
                  <td className="py-3.5 text-right font-bold text-zinc-100">{formatCurrency(grandTotals.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
