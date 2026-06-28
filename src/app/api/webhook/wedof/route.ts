import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, syncLogs, webhookLogs } from '@/db/schema';
import { mapWedofToDossier } from '@/lib/wedof';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function logWebhook(
  status: 'success' | 'failed',
  payload: any,
  headers: any,
  eventType?: string,
  externalId?: string,
  errorMessage?: string,
  durationMs?: number
) {
  try {
    await db.insert(webhookLogs).values({
      webhookType: 'wedof',
      event: eventType || 'unknown',
      externalId: externalId || null,
      status,
      payload: payload || null,
      headers: headers || null,
      errorMessage: errorMessage || null,
      durationMs: durationMs ? Math.round(durationMs) : null,
    });
  } catch (dbErr) {
    console.error('[Webhook WEDOF] Failed to write webhook log to DB:', dbErr);
  }
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  let headersObj: Record<string, string> = {};
  let body: any = null;
  let externalId: string | undefined = undefined;
  let eventType: string = 'unknown';

  try {
    // 1. Extract headers for logging
    headersObj = Object.fromEntries(request.headers.entries());

    // 2. Verify webhook secret
    const webhookSecret = process.env.WEDOF_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('x-webhook-secret') 
        || request.headers.get('authorization');
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        console.error('[Webhook WEDOF] Invalid secret');
        const duration = performance.now() - startTime;
        await logWebhook('failed', null, headersObj, 'unauthorized', undefined, 'Invalid webhook secret / unauthorized', duration);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 3. Parse the body safely
    try {
      body = await request.json();
    } catch (jsonErr: any) {
      console.error('[Webhook WEDOF] JSON parse error:', jsonErr.message);
      const duration = performance.now() - startTime;
      await logWebhook('failed', { rawText: 'Failed to parse JSON body' }, headersObj, 'malformed', undefined, 'JSON parse error: ' + jsonErr.message, duration);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Wedof can send the folder directly or wrapped
    const folder = body.registrationFolder || body.data || body;

    // Must have externalId
    externalId = folder?.externalId || folder?.external_id;
    eventType = body.event || body.type || 'unknown';

    if (!externalId) {
      console.error('[Webhook WEDOF] Invalid payload - missing externalId:', JSON.stringify(body).substring(0, 200));
      const duration = performance.now() - startTime;
      await logWebhook('failed', body, headersObj, eventType, undefined, 'Invalid payload - missing externalId', duration);
      return NextResponse.json({ error: 'Invalid payload - missing externalId' }, { status: 400 });
    }

    // Map Wedof folder to Drizzle format
    const dossierData = mapWedofToDossier(folder);

    // Upsert into PostgreSQL
    await db.insert(dossiers)
      .values(dossierData)
      .onConflictDoUpdate({
        target: dossiers.externalId,
        set: {
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          dob: sql`excluded.dob`,
          email: sql`excluded.email`,
          phone: sql`excluded.phone`,
          trainingTitle: sql`excluded.training_title`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          wedofStatus: sql`excluded.wedof_status`,
          amount: sql`excluded.amount`,
          wedofPaidDate: sql`excluded.wedof_paid_date`,
          rawData: sql`excluded.raw_data`,
          updatedAt: new Date(),
        }
      });

    console.log(`[Webhook WEDOF] ${eventType} - Dossier ${externalId} updated`);

    const duration = performance.now() - startTime;
    
    // Log in webhookLogs table
    await logWebhook('success', body, headersObj, eventType, externalId, undefined, duration);

    // Log event in sync_logs for backwards compatibility / cron logs
    await db.insert(syncLogs).values({
      syncType: 'wedof',
      status: 'success',
      recordsProcessed: 1,
      recordsCreated: 1,
      recordsUpdated: 0,
      durationMs: Math.round(duration),
      errorMessage: `webhook:${eventType}:${externalId}`,
    });

    return NextResponse.json({
      success: true,
      event: eventType,
      external_id: externalId,
      message: `Dossier ${externalId} updated successfully`,
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    console.error('[Webhook WEDOF] Error:', errorMessage);
    const duration = performance.now() - startTime;

    // Log the error in webhookLogs
    await logWebhook('failed', body, headersObj, eventType, externalId, errorMessage, duration);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'EDOF Dashboard - WEDOF Webhook',
    timestamp: new Date().toISOString(),
  });
}

