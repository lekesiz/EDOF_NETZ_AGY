import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, emailLogs } from '@/db/schema';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { detectSource, logActivity } from '@/lib/activity-log';
import { getEmailTemplate, renderEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FROM_EMAIL = 'Netz Informatique <noreply@netzinformatique.fr>';
const REPLY_TO_EMAIL = 'contact@netzinformatique.fr';
const EMAIL_SEND_DELAY_MS = 600;
const MAX_PROCESS = 300;

const TEST_EMAIL_PATTERNS = [
  '@test.', '@test@', 'test@test', '@example.', '@exemple.',
  'noreply@', 'no-reply@', '@localhost',
];

function isTestEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (e === 'test@test.com' || e.startsWith('test@')) return true;
  return TEST_EMAIL_PATTERNS.some((p) => e.includes(p));
}

let _resend: any = null;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    const { Resend } = require('resend');
    _resend = new Resend(key);
  }
  return _resend!;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    await new Promise((r) => setTimeout(r, EMAIL_SEND_DELAY_MS));
    const response = await getResend().emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: [to],
      subject,
      html,
    });
    if (response?.data?.id) return { success: true, id: response.data.id };
    return { success: false, error: response?.error?.message || "Pas d'ID Resend" };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
}

type DossierRow = {
  id: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  training_title: string | null;
  pennylane_paid_date: string | null;
  wedof_paid_date: string | null;
};

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const todayStr = todayISO();
  const targetDate = url.searchParams.get('date') || todayStr;
  const source = detectSource(request);

  try {
    const template = await getEmailTemplate('bon_achat');
    if (template && !template.enabled && !dryRun) {
      await logActivity({
        syncType: 'bon_achat',
        status: 'success',
        source,
        recordsProcessed: 0,
        recordsCreated: 0,
        durationMs: Date.now() - startTime,
        detail: 'Désactivé depuis Paramètres',
      });
      return NextResponse.json({ success: true, disabled: true, message: 'Bon d\'achat désactivé dans Paramètres' });
    }

    const data = await db.select({
      id: dossiers.id,
      external_id: dossiers.externalId,
      first_name: dossiers.firstName,
      last_name: dossiers.lastName,
      email: dossiers.email,
      training_title: dossiers.trainingTitle,
      pennylane_paid_date: dossiers.pennylanePaidDate,
      wedof_paid_date: dossiers.wedofPaidDate,
    })
    .from(dossiers)
    .where(
      and(
        isNotNull(dossiers.email),
        or(
          eq(dossiers.pennylanePaidDate, targetDate),
          eq(dossiers.wedofPaidDate, targetDate)
        )
      )
    )
    .limit(MAX_PROCESS);

    const all = data as DossierRow[];
    const paid = all.filter((d) => {
      return d.pennylane_paid_date === targetDate || d.wedof_paid_date === targetDate;
    });

    const prevLogs = await db.select({
      email: emailLogs.email,
    })
    .from(emailLogs)
    .where(eq(emailLogs.emailType, 'bon_achat'));

    const alreadySent = new Set(prevLogs.map((l) => l.email));

    const toSend = paid.filter(
      (d) => d.email && !alreadySent.has(d.email) && !isTestEmail(d.email)
    );

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        date: todayStr,
        targetDate,
        paid: paid.length,
        alreadySent: paid.length - toSend.length,
        toSend: toSend.length,
        sample: toSend.slice(0, 10).map((d) => ({
          externalId: d.external_id,
          name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
          email: d.email,
          paidDate: d.pennylane_paid_date || d.wedof_paid_date,
        })),
      });
    }

    let sent = 0;
    let failures = 0;
    const errors: string[] = [];
    const newLogs = [];

    for (const d of toSend) {
      const email = d.email!;
      const firstName = d.first_name || 'Madame, Monsieur';
      const vars = {
        firstName,
        lastName: d.last_name || '',
        formation: d.training_title || '',
      };
      const rendered = template
        ? renderEmailTemplate(template, vars)
        : {
            subject: 'Votre dossier est finalisé — contactez Netz Informatique',
            html: `<p>Bonjour ${firstName},</p><p>Vos démarches sont finalisées. Nous vous invitons à contacter Netz Informatique ou à passer nous voir.</p><p>Cordialement,<br/>L'équipe Netz Informatique</p>`,
          };
      const result = await sendEmailViaResend(email, rendered.subject, rendered.html);
      if (result.success && result.id) {
        sent++;
        newLogs.push({
          dossierId: d.id,
          email,
          emailType: 'bon_achat',
          subject: rendered.subject,
          dossierName: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
          externalId: d.external_id,
          resendId: result.id,
          sentAt: new Date(),
        });
      } else {
        failures++;
        errors.push(`${email}: ${result.error}`);
      }
    }

    if (newLogs.length > 0) {
      await db.insert(emailLogs).values(newLogs);
    }

    const duration = Date.now() - startTime;
    await logActivity({
      syncType: 'bon_achat',
      status: failures > 0 ? 'partial' : 'success',
      source,
      recordsProcessed: toSend.length,
      recordsCreated: sent,
      recordsUpdated: failures,
      detail: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      date: todayStr,
      paid: paid.length,
      sent,
      failures,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    try {
      await logActivity({
        syncType: 'bon_achat',
        status: 'failed',
        source,
        detail: errorMessage,
        durationMs: duration,
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
