'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  subtitle?: string;
}

export function StatCard({ title, value, icon: Icon, color, bgColor, subtitle }: StatCardProps) {
  const getGlowClass = () => {
    if (color.includes('emerald')) return 'glow-emerald';
    if (color.includes('amber')) return 'glow-amber';
    if (color.includes('red')) return 'hover:border-red-500/25 hover:shadow-[0_0_20px_-2px_rgba(239,68,68,0.25)]';
    return 'glow-blue';
  };

  return (
    <div className={cn(
      "rounded-2xl border border-zinc-800 bg-zinc-900/30 glass-card p-6 shadow-md group relative overflow-hidden",
      getGlowClass()
    )}>
      {/* Decorative pulse point */}
      <div className="absolute top-4 right-4 flex h-2 w-2">
        <span className={cn(
          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
          color.includes('emerald') ? 'bg-emerald-400' : color.includes('amber') ? 'bg-amber-400' : color.includes('red') ? 'bg-red-400' : 'bg-blue-400'
        )}></span>
        <span className={cn(
          "relative inline-flex rounded-full h-2 w-2",
          color.includes('emerald') ? 'bg-emerald-500' : color.includes('amber') ? 'bg-amber-500' : color.includes('red') ? 'bg-red-500' : 'bg-blue-500'
        )}></span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-grow space-y-1">
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{title}</p>
          <p className={cn('text-3xl font-extrabold tracking-tight transition-all duration-300', color)}>
            {formatCurrency(value)}
          </p>
          {subtitle && <p className="text-[11px] text-zinc-400 font-bold tracking-wide">{subtitle}</p>}
        </div>
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl border border-opacity-10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300',
          bgColor
        )}>
          <Icon className={cn('h-5.5 w-5.5', color)} />
        </div>
      </div>
    </div>
  );
}
