import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { detectSource, logActivity } from '@/lib/activity-log';
import {
  appendSuiviRows,
  getExistingExternalIds,
  type SuiviRow,
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PROCESS = 500;

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function get(obj: any, path: string): any {
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = cur[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function str(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

type DossierRow = {
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  training_title: string | null;
  start_date: string | null;
  end_date: string | null;
  accepted_date: Date | null;
  raw_data: any;
};

function buildRow(d: DossierRow): SuiviRow {
  const raw = d.raw_data || {};
  const attendee = get(raw, 'attendee') || {};
  const tai = get(raw, 'trainingActionInfo') || {};

  const acceptedDateStr = d.accepted_date 
    ? d.accepted_date.toISOString().split('T')[0] 
    : str(get(raw, 'history.acceptedDate'));

  return [
    str(d.external_id || get(raw, 'externalId')),
    str(attendee.id ?? get(raw, 'attendee.id')),
    str(d.last_name ?? attendee.lastName),
    str(d.first_name ?? attendee.firstName),
    str(d.email ?? attendee.email),
    str(d.phone ?? attendee.phoneNumber),
    str(attendee.dateOfBirth),
    str(attendee.gender),
    str(attendee.nameCountryOfBirth),
    str(attendee.fullAddress),
    acceptedDateStr,
    str(tai.vat),
    str(d.training_title ?? tai.title),
    str(tai.sessionStartDate),
    str(tai.sessionEndDate),
    str(tai.indicativeDuration),
  ];
}

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
  const days = Math.max(0, parseInt(url.searchParams.get('days') || '0', 10) || 0);

  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - days);
  const fromISO = fromDate.toISOString().split('T')[0];
  const toISO = todayISO();

  try {
    const data = await db.select({
      external_id: dossiers.externalId,
      first_name: dossiers.firstName,
      last_name: dossiers.lastName,
      email: dossiers.email,
      phone: dossiers.phone,
      training_title: dossiers.trainingTitle,
      start_date: dossiers.startDate,
      end_date: dossiers.endDate,
      accepted_date: dossiers.acceptedDate,
      raw_data: dossiers.rawData,
    })
    .from(dossiers)
    .where(
      and(
        eq(dossiers.wedofStatus, 'serviceDoneValidated'),
        gte(dossiers.serviceDoneValidatedDate, new Date(`${fromISO}T00:00:00`)),
        lte(dossiers.serviceDoneValidatedDate, new Date(`${toISO}T23:59:59`))
      )
    )
    .limit(MAX_PROCESS);

    const all = data as DossierRow[];

    const cpf = all.filter((d) => {
      const t = get(d.raw_data || {}, 'type');
      return t === undefined || t === null || String(t).toLowerCase() === 'cpf';
    });

    const existing = await getExistingExternalIds();
    const toAdd = cpf.filter((d) => d.external_id && !existing.has(d.external_id));

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        range: { from: fromISO, to: toISO },
        source: 'database',
        matched: all.length,
        cpf: cpf.length,
        alreadyInSheet: cpf.length - toAdd.length,
        toAdd: toAdd.length,
        sample: toAdd.slice(0, 8).map((d) => ({
          externalId: d.external_id,
          name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim(),
        })),
      });
    }

    const rows = toAdd.map(buildRow);
    const added = await appendSuiviRows(rows);

    const duration = Date.now() - startTime;
    await logActivity({
      syncType: 'sheets_suivi',
      status: 'success',
      source,
      recordsProcessed: cpf.length,
      recordsCreated: added,
      recordsUpdated: cpf.length - toAdd.length,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      range: { from: fromISO, to: toISO },
      source: 'database',
      matched: all.length,
      cpf: cpf.length,
      alreadyInSheet: cpf.length - toAdd.length,
      added,
      duration_ms: duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    try {
      await logActivity({
        syncType: 'sheets_suivi',
        status: 'failed',
        source,
        detail: errorMessage,
        durationMs: duration,
      });
    } catch {
      /* ignore log failure */
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
