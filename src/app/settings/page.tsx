'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface SettingItem {
  value: string;
  updated_at: string;
}

type SettingsData = Record<string, SettingItem>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [vadeGun, setVadeGun] = useState('37');
  const [target2025, setTarget2025] = useState('1000000');
  const [target2026, setTarget2026] = useState('2000000');
  const [target2027, setTarget2027] = useState('4000000');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (!res.ok) throw new Error('Échec du chargement des paramètres');
        const data: SettingsData = await res.json();
        setSettings(data);
        
        if (data.vade_gun) setVadeGun(data.vade_gun.value);
        if (data.target_2025) setTarget2025(data.target_2025.value);
        if (data.target_2026) setTarget2026(data.target_2026.value);
        if (data.target_2027) setTarget2027(data.target_2027.value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (key: string, value: string) => {
    setSaving(key);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour');
      setSuccess(`Paramètre "${key}" enregistré avec succès.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 rounded bg-zinc-800" />
        <div className="h-44 rounded-xl bg-zinc-900/50" />
        <div className="h-44 rounded-xl bg-zinc-900/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-500" />
          <span>Configuration Système</span>
        </h2>
        <p className="mt-1 text-xs text-zinc-500 font-medium">
          Gérer les objectifs annuels et les règles de calcul financier
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-900/30 bg-red-950/10 p-4 text-sm text-red-400 font-medium">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4 text-sm text-emerald-400 font-medium">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Form Section */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Financial Rules Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Règles de Trésorerie</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Règles de calcul pour le tableau de bord financier</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2 space-y-2">
              <label htmlFor="vade_gun" className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Délai d'échéance règlement (Jours)</span>
                <span className="cursor-help flex items-center" title="Nombre de jours ajoutés à la date de fin de session pour estimer la date d'encaissement">
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-500" />
                </span>
              </label>
              <input
                id="vade_gun"
                type="number"
                value={vadeGun}
                onChange={(e) => setVadeGun(e.target.value)}
                className="w-full max-w-xs rounded-xl px-4 py-2.5 text-sm text-zinc-200 premium-input transition-all"
              />
              <p className="text-[10px] text-zinc-500 font-medium">
                Par défaut : 37 jours (Date de fin + 37j) pour correspondre au versement Wedof / CDC.
              </p>
            </div>
            <div className="text-right">
              <button
                onClick={() => handleSave('vade_gun', vadeGun)}
                disabled={saving === 'vade_gun'}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center gap-2 ml-auto shadow-md shadow-blue-500/10"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving === 'vade_gun' ? 'Enregistrement...' : 'Sauvegarder'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* CA Objectives Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Objectifs de Chiffre d'Affaires</h3>
            <p className="text-xs text-zinc-500 mt-0.5">CA visé pour la jauge de progression du tableau de bord</p>
          </div>

          <div className="space-y-6 divide-y divide-zinc-800/40">
            {/* Target 2025 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Objectif CA 2025</span>
              <input
                type="number"
                value={target2025}
                onChange={(e) => setTarget2025(e.target.value)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-200 premium-input transition-all w-full max-w-xs"
              />
              <button
                onClick={() => handleSave('target_2025', target2025)}
                disabled={saving === 'target_2025'}
                className="rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 hover:text-zinc-100 px-4 py-2 text-xs font-bold text-zinc-300 disabled:opacity-50 transition-all flex items-center gap-1.5 ml-auto"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving === 'target_2025' ? 'Enreg...' : 'Enregistrer'}</span>
              </button>
            </div>

            {/* Target 2026 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-6">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Objectif CA 2026</span>
              <input
                type="number"
                value={target2026}
                onChange={(e) => setTarget2026(e.target.value)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-200 premium-input transition-all w-full max-w-xs font-bold"
              />
              <button
                onClick={() => handleSave('target_2026', target2026)}
                disabled={saving === 'target_2026'}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center gap-1.5 ml-auto shadow-md shadow-blue-500/10"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving === 'target_2026' ? 'Enreg...' : 'Enregistrer'}</span>
              </button>
            </div>

            {/* Target 2027 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-6">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Objectif CA 2027</span>
              <input
                type="number"
                value={target2027}
                onChange={(e) => setTarget2027(e.target.value)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-200 premium-input transition-all w-full max-w-xs"
              />
              <button
                onClick={() => handleSave('target_2027', target2027)}
                disabled={saving === 'target_2027'}
                className="rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 hover:text-zinc-100 px-4 py-2 text-xs font-bold text-zinc-300 disabled:opacity-50 transition-all flex items-center gap-1.5 ml-auto"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving === 'target_2027' ? 'Enreg...' : 'Enregistrer'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
