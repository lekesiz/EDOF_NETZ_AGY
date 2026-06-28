import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, emailLogs } from '@/db/schema';
import { eq, and, gte, lt, isNotNull, inArray } from 'drizzle-orm';
import { detectSource, logActivity } from '@/lib/activity-log';
import { getEmailTemplate, renderEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const FROM_EMAIL = 'Netz Informatique <noreply@netzinformatique.fr>';
const REPLY_TO_EMAIL = 'contact@netzinformatique.fr';
const EMAIL_SEND_DELAY_MS = 600;

const RELANCE_STATES = ['validated', 'waitingAcceptation'];
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
    if (response?.data?.id) {
      return { success: true, id: response.data.id };
    }
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
  wedof_status: string;
  training_title: string | null;
  validated_date: Date | null;
  raw_data: any;
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
  const source = detectSource(request);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = todayISO();

  try {
    const template = await getEmailTemplate('relance_paiement');
    if (template && !template.enabled && !dryRun) {
      await logActivity({
        syncType: 'relance_paiement',
        status: 'success',
        source,
        recordsProcessed: 0,
        recordsCreated: 0,
        durationMs: Date.now() - startTime,
        detail: 'Désactivé depuis Paramètres',
      });
      return NextResponse.json({ success: true, disabled: true, message: 'Relance désactivée dans Paramètres' });
    }

    const data = await db.select({
      id: dossiers.id,
      external_id: dossiers.externalId,
      first_name: dossiers.firstName,
      last_name: dossiers.lastName,
      email: dossiers.email,
      wedof_status: dossiers.wedofStatus,
      training_title: dossiers.trainingTitle,
      validated_date: dossiers.validatedDate,
      raw_data: dossiers.rawData,
    })
    .from(dossiers)
    .where(
      and(
        inArray(dossiers.wedofStatus, RELANCE_STATES),
        isNotNull(dossiers.email)
      )
    )
    .limit(MAX_PROCESS);

    const all = data as DossierRow[];
    const inWindow = all;

    const todayLogs = await db.select({
      email: emailLogs.email,
    })
    .from(emailLogs)
    .where(
      and(
        eq(emailLogs.emailType, 'relance_paiement'),
        gte(emailLogs.sentAt, new Date(`${todayStr}T00:00:00Z`)),
        lt(emailLogs.sentAt, new Date(`${todayStr}T23:59:59Z`))
      )
    );

    const alreadySent = new Set(todayLogs.map((l) => l.email));

    const toSend = inWindow.filter(
      (d) => d.email && !alreadySent.has(d.email) && !isTestEmail(d.email)
    );

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        date: todayStr,
        matched: all.length,
        inWindow: inWindow.length,
        alreadySentToday: inWindow.length - toSend.length,
        toSend: toSend.length,
        sample: toSend.slice(0, 10).map((d) => ({
          externalId: d.external_id,
          name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
          status: d.wedof_status,
          email: d.email,
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
            subject: 'Finalisez votre inscription — acceptation et règlement de votre dossier',
            html: `<p>Bonjour ${firstName},</p><p>Votre dossier de formation a bien été validé. Merci de vous connecter à Mon Compte Formation pour accepter et régler votre dossier.</p><p>Cordialement,<br/>L'équipe Netz Informatique</p>`,
          };
      const subject = rendered.subject;
      const html = rendered.html;
      const result = await sendEmailViaResend(email, subject, html);
      if (result.success && result.id) {
        sent++;
        newLogs.push({
          dossierId: d.id,
          email,
          emailType: 'relance_paiement',
          subject,
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
      syncType: 'relance_paiement',
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
      processed: toSend.length,
      succeeded: sent,
      failed: failures,
      duration_ms: duration,
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    await logActivity({
      syncType: 'relance_paiement',
      status: 'failed',
      source,
      detail: errorMessage,
      durationMs: duration,
    });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
