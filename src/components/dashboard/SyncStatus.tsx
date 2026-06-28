'use client';

import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';

interface SyncStatusProps {
  lastWedofSync: string | null;
  lastPennylaneSync: string | null;
}

export function SyncStatus({ lastWedofSync, lastPennylaneSync }: SyncStatusProps) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const triggerSync = async (type: 'wedof' | 'pennylane') => {
    setSyncing(type);
    setMessage(null);
    try {
      // In development/test, we automatically send the CRON_SECRET if configured,
      // or a fallback to trigger the API.
      const res = await fetch(`/api/sync/${type}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'edof-cron-secret-2026'}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Sync ${type.toUpperCase()} complétée (${data.processed || data.invoices_fetched || 0} traités)`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(`Erreur: ${data.error}`);
      }
    } catch (err) {
      setMessage('Échec de la synchronisation.');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5">
      <h3 className="mb-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Synchronisation</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {lastWedofSync ? (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-200">WEDOF API</span>
              <span className="text-[10px] text-zinc-500 font-medium">
                {lastWedofSync ? formatDate(lastWedofSync) : 'Jamais sync'}
              </span>
            </div>
          </div>
          <button
            onClick={() => triggerSync('wedof')}
            disabled={syncing !== null}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600/10 border border-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-600/25 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${syncing === 'wedof' ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
        
        <div className="flex items-center justify-between border-t border-zinc-800/40 pt-4">
          <div className="flex items-center gap-2.5">
            {lastPennylaneSync ? (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-200">Pennylane API</span>
              <span className="text-[10px] text-zinc-500 font-medium">
                {lastPennylaneSync ? formatDate(lastPennylaneSync) : 'Jamais sync'}
              </span>
            </div>
          </div>
          <button
            onClick={() => triggerSync('pennylane')}
            disabled={syncing !== null}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-600/25 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${syncing === 'pennylane' ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      </div>
      {message && (
        <p className="mt-4 text-center text-xs font-semibold text-zinc-400 bg-zinc-950/40 border border-zinc-800/40 py-2 px-3 rounded-lg">{message}</p>
      )}
    </div>
  );
}
