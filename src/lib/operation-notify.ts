/**
 * operation-notify.ts — Notifications e-mail temps réel pour chaque opération automatique EDOF.
 */

const NOTIFY_TO = process.env.OPERATION_NOTIFY_EMAIL || 'mikail@netzinformatique.fr';
const FROM_EMAIL = 'EDOF Notifications <noreply@netzinformatique.fr>';
const REPLY_TO_EMAIL = 'contact@netzinformatique.fr';

export type OperationType =
  | 'formation_entree'
  | 'formation_sortie'
  | 'service_fait'
  | 'facture';

export type OperationStatus = 'success' | 'skipped' | 'failed';

export interface OperationDetails {
  externalId: string;
  attendeeName?: string | null;
  email?: string | null;
  trainingTitle?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  amount?: number | null;
  invoiceNumber?: string | null;
  /** Message d'erreur si status = failed */
  errorMessage?: string | null;
  /** Détail libre additionnel (ex: « déjà dans l'état cible ») */
  note?: string | null;
}

const OP_LABELS: Record<OperationType, { fr: string; emoji: string }> = {
  formation_entree: { fr: 'Entrée en formation', emoji: '🎬' },
  formation_sortie: { fr: 'Sortie de formation', emoji: '🏁' },
  service_fait: { fr: 'Service fait (Caisse des Dépôts)', emoji: '📨' },
  facture: { fr: 'Facture créée (Pennylane)', emoji: '🧾' },
};

const STATUS_LABELS: Record<OperationStatus, { fr: string; emoji: string; color: string }> = {
  success: { fr: 'Succès', emoji: '✅', color: '#16a34a' },
  skipped: { fr: 'Ignoré (déjà à jour)', emoji: '⏭️', color: '#ca8a04' },
  failed: { fr: 'Échec', emoji: '❌', color: '#dc2626' },
};

let _resend: any = null;
function getResend(): any {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) {
    const { Resend } = require('resend');
    _resend = new Resend(key);
  }
  return _resend;
}

function fmtAmount(amount?: number | null): string {
  if (amount === null || amount === undefined) return 'N/A';
  return `${amount.toFixed(2)} €`;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSubject(op: OperationType, status: OperationStatus, d: OperationDetails): string {
  const opL = OP_LABELS[op];
  const stL = STATUS_LABELS[status];
  const who = d.attendeeName ? ` — ${d.attendeeName}` : '';
  return `${stL.emoji} ${opL.fr}${who} (${d.externalId})`;
}

function buildHtml(op: OperationType, status: OperationStatus, d: OperationDetails): string {
  const opL = OP_LABELS[op];
  const stL = STATUS_LABELS[status];
  const rows: Array<[string, string]> = [
    ['Opération', `${opL.emoji} ${esc(opL.fr)}`],
    ['Statut', `<span style="color:${stL.color};font-weight:600">${stL.emoji} ${esc(stL.fr)}</span>`],
    ['Dossier', esc(d.externalId)],
  ];
  if (d.attendeeName) rows.push(['Apprenant', esc(d.attendeeName)]);
  if (d.email) rows.push(['E-mail', esc(d.email)]);
  if (d.trainingTitle) rows.push(['Formation', esc(d.trainingTitle)]);
  if (d.startDate || d.endDate) {
    rows.push(['Session', `${esc(d.startDate || '—')} → ${esc(d.endDate || '—')}`]);
  }
  if (op === 'facture') {
    rows.push(['Montant', esc(fmtAmount(d.amount))]);
    if (d.invoiceNumber) rows.push(['N° Facture', esc(d.invoiceNumber)]);
  }
  if (d.note) rows.push(['Note', esc(d.note)]);
  if (status === 'failed' && d.errorMessage) {
    rows.push(['Erreur', `<span style="color:#dc2626">${esc(d.errorMessage)}</span>`]);
  }

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td>` +
        `<td style="padding:6px 12px;color:#111827;font-size:14px;font-weight:500">${v}</td></tr>`
    )
    .join('');

  const when = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:${stL.color};padding:16px 20px">
      <div style="color:#ffffff;font-size:16px;font-weight:700">${stL.emoji} ${esc(opL.fr)}</div>
      <div style="color:#ffffffcc;font-size:13px;margin-top:2px">EDOF — Notification automatique · ${esc(when)}</div>
    </div>
    <div style="padding:8px 8px 4px 8px">
      <table style="width:100%;border-collapse:collapse">${tableRows}</table>
    </div>
    <div style="padding:12px 20px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">
      Cet e-mail est envoyé automatiquement à chaque opération du système EDOF (entrée, sortie, service fait, facture) pour le suivi de test.
    </div>
  </div>
</body></html>`;
}

/**
 * Envoie une notification d'opération par e-mail (non-bloquant).
 * Ne lève jamais d'exception : en cas d'erreur, log uniquement.
 */
export async function sendOperationNotification(
  op: OperationType,
  status: OperationStatus,
  details: OperationDetails
): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) {
      console.warn('[operation-notify] RESEND_API_KEY absent — notification ignorée');
      return;
    }
    const subject = buildSubject(op, status, details);
    const html = buildHtml(op, status, details);
    await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: [NOTIFY_TO],
      subject,
      html,
    });
  } catch (e) {
    console.error('[operation-notify] échec envoi notification:', e instanceof Error ? e.message : e);
  }
}
