import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { detectSource, logActivity } from '@/lib/activity-log';
import { sendOperationNotification, type OperationType } from '@/lib/operation-notify';
import {
  declareInTraining,
  declareTerminated,
  declareServiceDone,
  selectCandidatesFromDb,
  attendeeName,
  type DbCandidate,
  type LifecycleResult,
  type DbStep,
} from '@/lib/wedof-lifecycle';

const STEP_TO_OP: Record<string, OperationType> = {
  intraining: 'formation_entree',
  terminate: 'formation_sortie',
  servicedone: 'service_fait',
};

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

const MAX_PROCESS = 150;

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.WEDOF_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing WEDOF_API_KEY' }, { status: 500 });
  }

  const url = new URL(request.url);
  const step = (url.searchParams.get('step') || '') as DbStep;
  const dryRun = url.searchParams.get('dryRun') === '1';
  const source = detectSource(request);

  if (!['intraining', 'terminate', 'servicedone'].includes(step)) {
    return NextResponse.json(
      { error: "Paramètre 'step' requis : intraining | terminate | servicedone" },
      { status: 400 }
    );
  }

  const today = todayISO();
  const results: LifecycleResult[] = [];
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  try {
    let candidates = await selectCandidatesFromDb(step, today, MAX_PROCESS);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        step,
        date: today,
        source: 'database',
        candidates: candidates.length,
        sample: candidates.slice(0, 8).map((c) => ({
          externalId: c.external_id,
          name: attendeeName(c),
          wedof_status: c.wedof_status,
          start_date: c.start_date,
          end_date: c.end_date,
        })),
      });
    }

    if (candidates.length > MAX_PROCESS) {
      candidates = candidates.slice(0, MAX_PROCESS);
    }

    const now = new Date();
    for (const c of candidates) {
      const externalId = c.external_id;
      const name = attendeeName(c);
      if (!externalId) continue;

      try {
        let outcome: 'success' | 'skipped';
        if (step === 'intraining') {
          outcome = await declareInTraining(apiKey, externalId, c.start_date);
          if (outcome === 'success') {
            await db.update(dossiers)
              .set({
                wedofStatus: 'inTraining',
                inTrainingDate: now,
                updatedAt: now,
              })
              .where(eq(dossiers.externalId, externalId));
          }
        } else if (step === 'terminate') {
          outcome = await declareTerminated(apiKey, externalId, c.end_date);
          if (outcome === 'success') {
            await db.update(dossiers)
              .set({
                wedofStatus: 'terminated',
                terminatedDate: now,
                updatedAt: now,
              })
              .where(eq(dossiers.externalId, externalId));
          }
        } else {
          outcome = await declareServiceDone(apiKey, externalId);
          if (outcome === 'success') {
            await db.update(dossiers)
              .set({
                wedofStatus: 'serviceDoneDeclared',
                serviceDoneDeclaredDate: now,
                updatedAt: now,
              })
              .where(eq(dossiers.externalId, externalId));
          }
        }

        if (outcome === 'success') succeeded++;
        else skipped++;
        results.push({ externalId, attendeeName: name, status: outcome });

        await sendOperationNotification(STEP_TO_OP[step], outcome, {
          externalId,
          attendeeName: name,
          startDate: c.start_date,
          endDate: c.end_date,
          note: outcome === 'skipped' ? 'Dossier déjà dans l\'état cible' : null,
        });
      } catch (err) {
        failed++;
        const detail = err instanceof Error ? err.message : String(err);
        results.push({ externalId, attendeeName: name, status: 'failed', detail });
        console.error(`[Lifecycle ${step}] ${externalId} failed:`, detail);

        await sendOperationNotification(STEP_TO_OP[step], 'failed', {
          externalId,
          attendeeName: name,
          startDate: c.start_date,
          endDate: c.end_date,
          errorMessage: detail,
        });
      }
    }

    const duration = Date.now() - startTime;
    await logActivity({
      syncType: `lifecycle_${step}`,
      status: failed > 0 ? 'partial' : 'success',
      source,
      recordsProcessed: candidates.length,
      recordsCreated: succeeded,
      recordsUpdated: skipped,
      detail: failed > 0 ? `${failed} échec(s)` : null,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      step,
      date: today,
      source: 'database',
      processed: candidates.length,
      succeeded,
      skipped,
      failed,
      duration_ms: duration,
      results,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    await logActivity({
      syncType: `lifecycle_${step}`,
      status: 'failed',
      source,
      detail: errorMessage,
      durationMs: duration,
    });
    return NextResponse.json({ success: false, step, error: errorMessage }, { status: 500 });
  }
}
