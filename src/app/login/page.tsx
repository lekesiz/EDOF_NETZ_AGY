'use client';

import React, { useState } from 'react';
import { Mail, Lock, ShieldAlert, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Identifiants invalides');
      }

      // Refresh page / redirect
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 relative px-4 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
      
      {/* Decorative dotted pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.015)_1px,transparent_0)] bg-[size:32px_32px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 text-white font-extrabold text-lg shadow-xl shadow-blue-500/20 mb-3 animate-pulse">
            ED
          </div>
          <h1 className="text-xl font-extrabold tracking-wider text-zinc-100 uppercase bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            EDOF Dashboard
          </h1>
          <p className="text-[9px] text-zinc-500 font-extrabold tracking-widest uppercase mt-0.5">
            NETZ AGY FINANCIAL
          </p>
        </div>

        {/* Login Glass Card */}
        <div className="glass-panel rounded-3xl p-8 border border-zinc-900/60 shadow-2xl shadow-black/90">
          <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-zinc-900/50">
            <KeyRound className="h-5 w-5 text-blue-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
              Connexion Admin
            </h2>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-red-950/40 border border-red-500/20 text-red-200 text-xs">
              <ShieldAlert className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Adresse E-mail
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 pointer-events-none">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="admin@netzinformatique.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 premium-input transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Mot de Passe
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 pointer-events-none">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 premium-input transition-all duration-200"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] shadow-lg shadow-blue-600/10"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Se Connecter'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
