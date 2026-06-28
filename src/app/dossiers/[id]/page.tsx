'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Calendar, GraduationCap, Mail, Phone, Clock, DollarSign, CheckCircle2, AlertTriangle, FileText, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DossierDetails {
  id: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  training_title: string | null;
  start_date: string | null;
  end_date: string | null;
  wedof_status: string;
  amount: number;
  is_reconciled: boolean;
  pennylane_invoice_number: string | null;
  pennylane_paid_date: string | null;
  wedof_paid_date: string | null;
  vade_tarihi: string | null;
  vade_gun: number;
  categorie: 'encaisse' | 'en_attente' | 'annule';
}

interface WedofDetails {
  type: string | null;
  state: string | null;
  completionRate: number | null;
  certificationState: string | null;
  billingState: string | null;
  organism: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  notes: string | null;
  tags: string[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  paidDate: string | null;
  isPaid: boolean;
  rawData: any;
  createdAt: string;
}

interface EmailLog {
  id: string;
  email: string;
  email_type: string;
  resend_id: string | null;
  sent_at: string;
}

export default function DossierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<{
    dossier: DossierDetails;
    wedofDetails: WedofDetails | null;
    invoice: Invoice | null;
    emails: EmailLog[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function fetchDossierDetails() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dossiers/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 404) throw new Error('Dossier introuvable');
          throw new Error('Échec du chargement des détails du dossier');
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }
    fetchDossierDetails();
  }, [id]);

  const formatDateString = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('cancel') || s.includes('refus') || s.includes('reject') || s.includes('annul') || s.includes('abandon')) {
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    }
    if (s === 'billed' || s.includes('paid') || s.includes('done') || s.includes('valid')) {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 rounded bg-zinc-800" />
        <div className="h-12 w-96 rounded bg-zinc-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 rounded-xl bg-zinc-900/50" />
          <div className="h-64 rounded-xl bg-zinc-900/50" />
          <div className="h-64 rounded-xl bg-zinc-900/50" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-6 text-center max-w-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-red-400">{error || 'Dossier introuvable'}</p>
          <button
            onClick={() => router.push('/dossiers')}
            className="mt-4 rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Retour aux dossiers
          </button>
        </div>
      </div>
    );
  }

  const { dossier, wedofDetails, invoice, emails } = data;

  // Compute timeline steps
  const steps = [
    { label: 'Inscription', done: true },
    { label: 'En formation', done: dossier.wedof_status !== 'instruction' },
    { label: 'Validation service fait', done: ['serviceDoneValidated', 'serviceDoneDeclared', 'billed', 'paid'].some(s => dossier.wedof_status.toLowerCase().includes(s)) },
    { label: 'Facturation (Pennylane)', done: !!dossier.pennylane_invoice_number },
    { label: 'Paiement / Mutabakat', done: dossier.is_reconciled || !!dossier.pennylane_paid_date },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div>
        <button
          onClick={() => router.push('/dossiers')}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Retour aux dossiers</span>
        </button>
      </div>

      {/* Header Profile Summary */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-tr from-zinc-900 via-zinc-900 to-zinc-850 p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-zinc-100 tracking-tight">
                {dossier.last_name} {dossier.first_name}
              </h2>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusBadgeClass(dossier.wedof_status)}`}>
                WEDOF: {dossier.wedof_status}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-xs text-zinc-500 font-semibold tracking-wide">
              ID DOSSIER: {dossier.external_id}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Montant Dossier</p>
            <p className="text-3xl font-black text-emerald-400 mt-1">{formatCurrency(dossier.amount)}</p>
          </div>
        </div>

        {/* Dynamic Timeline Stepper */}
        <div className="mt-8 border-t border-zinc-800/80 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-4 relative">
            {steps.map((step, idx) => (
              <div key={idx} className="flex-1 flex md:flex-col items-center md:text-center gap-4 relative w-full group">
                {/* Horizontal line for desktop connecting steps */}
                {idx < steps.length - 1 && (
                  <div className={`hidden md:block absolute top-4.5 left-[60%] right-[-40%] h-[2px] transition-all duration-500 ${
                    steps[idx + 1].done
                      ? 'bg-blue-600 shadow-[0_0_8px_#3b82f6]'
                      : 'bg-zinc-800'
                  }`} />
                )}
                
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold border transition-all duration-300 ${
                  step.done
                    ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-550'
                }`}>
                  {step.done ? (
                    <span className="text-xs font-extrabold text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]">✓</span>
                  ) : idx + 1}
                </div>
                
                <div className="flex flex-col md:items-center">
                  <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${step.done ? 'text-zinc-200' : 'text-zinc-555'}`}>
                    {step.label}
                  </span>
                  {idx === 3 && dossier.pennylane_invoice_number && (
                    <span className="text-[10px] font-mono text-blue-400 font-semibold mt-0.5">{dossier.pennylane_invoice_number}</span>
                  )}
                  {idx === 4 && dossier.is_reconciled && (
                    <span className="text-[9px] uppercase font-extrabold text-emerald-400 tracking-wider mt-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">✓ Matché</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Contact details */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" />
            <span>Informations personnelles</span>
          </h3>
          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between py-1 border-b border-zinc-800/40">
              <span className="text-zinc-500 font-semibold">Nom complet</span>
              <span className="text-zinc-200 font-bold">{dossier.first_name} {dossier.last_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/40">
              <span className="text-zinc-500 font-semibold">E-mail</span>
              <a href={`mailto:${dossier.email || ''}`} className="text-blue-400 hover:underline font-medium">
                {dossier.email || 'Non renseigné'}
              </a>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/40">
              <span className="text-zinc-500 font-semibold">Téléphone</span>
              <span className="text-zinc-300 font-mono">{dossier.phone || 'Non renseigné'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/40">
              <span className="text-zinc-500 font-semibold">Date de naissance</span>
              <span className="text-zinc-300">{formatDateString(dossier.dob)}</span>
            </div>
          </div>
        </div>

        {/* Training Details */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-indigo-400" />
            <span>Détails de la Formation</span>
          </h3>
          <div className="space-y-3.5 text-sm">
            <div className="flex flex-col gap-1 pb-2 border-b border-zinc-800/40">
              <span className="text-zinc-500 font-semibold">Titre de formation</span>
              <span className="text-zinc-200 font-bold">{dossier.training_title || 'Non renseigné'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/40">
              <span className="text-zinc-500 font-semibold">Date de début</span>
              <span className="text-zinc-300 font-semibold">{formatDateString(dossier.start_date)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/40">
              <span className="text-zinc-500 font-semibold">Date de fin</span>
              <span className="text-zinc-300 font-semibold">{formatDateString(dossier.end_date)}</span>
            </div>
            <div className="flex justify-between py-1">
              <div className="flex flex-col">
                <span className="text-zinc-500 font-semibold flex items-center gap-1">
                  <span>Échéance CA (+{dossier.vade_gun}j)</span>
                  <Clock className="h-3 w-3 text-zinc-500" />
                </span>
                {dossier.categorie === 'encaisse' ? (
                  <span className="text-[10px] text-emerald-400 font-bold uppercase mt-0.5">✓ Échéance passée (CA échu)</span>
                ) : (
                  <span className="text-[10px] text-amber-500 font-bold uppercase mt-0.5">⏱ À venir</span>
                )}
              </div>
              <span className="text-zinc-200 font-extrabold self-center">
                {formatDateString(dossier.vade_tarihi)}
              </span>
            </div>
          </div>
        </div>

        {/* Pennylane Invoice Cache */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-400" />
            <span>Facture Pennylane</span>
          </h3>
          {dossier.pennylane_invoice_number ? (
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500 font-semibold">N° Facture</span>
                <span className="text-zinc-200 font-mono font-bold">{dossier.pennylane_invoice_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500 font-semibold">Tension de paiement</span>
                {invoice?.isPaid ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                    Payée
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500 border border-amber-500/20">
                    En attente règlement
                  </span>
                )}
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-500 font-semibold">Date de paiement</span>
                <span className="text-zinc-300 font-semibold">
                  {dossier.pennylane_paid_date ? formatDateString(dossier.pennylane_paid_date) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 font-semibold">Rapprochement</span>
                {dossier.is_reconciled ? (
                  <span className="text-emerald-400 font-extrabold">Filtre Rapproché</span>
                ) : (
                  <span className="text-amber-500 font-bold">Non matché</span>
                )}
              </div>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl p-4">
              <DollarSign className="h-6 w-6 text-zinc-600 mb-1" />
              <p className="text-xs font-semibold">Aucune facture associée.</p>
              <p className="text-[10px] text-zinc-650 mt-1">Sera créé au prochain passage de la tâche cron.</p>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Details & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* WEDOF Raw / Metadata */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Métadonnées WEDOF</h3>
          {wedofDetails ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="border-b border-zinc-800/40 pb-2">
                <span className="text-zinc-500 block">État du dossier</span>
                <span className="text-zinc-300 block mt-1 font-bold text-sm">{wedofDetails.state || 'N/A'}</span>
              </div>
              <div className="border-b border-zinc-800/40 pb-2">
                <span className="text-zinc-500 block">Facturation WEDOF</span>
                <span className="text-zinc-300 block mt-1 font-bold text-sm">{wedofDetails.billingState || 'N/A'}</span>
              </div>
              <div className="border-b border-zinc-800/40 pb-2">
                <span className="text-zinc-500 block">Organisme de formation</span>
                <span className="text-zinc-300 block mt-1 font-medium">{wedofDetails.organism || 'N/A'}</span>
              </div>
              <div className="border-b border-zinc-800/40 pb-2">
                <span className="text-zinc-500 block">Certification</span>
                <span className="text-zinc-300 block mt-1 font-medium">{wedofDetails.certificationState || 'N/A'}</span>
              </div>
              <div className="border-b border-zinc-800/40 pb-2">
                <span className="text-zinc-500 block">Taux d'assiduité / Complétion</span>
                <span className="text-zinc-300 block mt-1 font-bold text-sm">{wedofDetails.completionRate ? `${wedofDetails.completionRate}%` : 'N/A'}</span>
              </div>
              <div className="border-b border-zinc-800/40 pb-2">
                <span className="text-zinc-500 block">Type de dossier</span>
                <span className="text-zinc-350 block mt-1">{wedofDetails.type || 'N/A'}</span>
              </div>
              {wedofDetails.notes && (
                <div className="sm:col-span-2 border-b border-zinc-800/40 pb-2">
                  <span className="text-zinc-500 block">Notes internes</span>
                  <p className="text-zinc-300 mt-1.5 bg-zinc-950/40 p-2.5 rounded border border-zinc-800/40 font-medium font-mono text-[11px] whitespace-pre-wrap">{wedofDetails.notes}</p>
                </div>
              )}
              {wedofDetails.tags && wedofDetails.tags.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-zinc-500 block mb-1.5">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {wedofDetails.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 font-bold border border-zinc-700/30">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">Aucune donnée brute Wedof disponible.</p>
          )}
        </div>

        {/* E-mails History */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 glass-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-400" />
            <span>Historique des communications</span>
          </h3>
          {emails.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-6 text-center">
              Aucun e-mail envoyé à cet apprenant.
            </p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {emails.map((e) => (
                <div key={e.id} className="rounded-lg border border-zinc-800/60 bg-zinc-950/20 p-3 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-300">
                      {e.email_type === 'bday' ? '🎂 Anniversaire' : e.email_type === 'survey1' ? '📝 Enquête J+1' : '📝 Enquête M+6'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      {format(parseISO(e.sent_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-medium">
                    <span className="text-zinc-500 truncate max-w-[120px]">{e.email}</span>
                    {e.resend_id && (
                      <span className="font-mono text-[9px] text-zinc-550">ID: {e.resend_id.slice(0, 10)}...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
