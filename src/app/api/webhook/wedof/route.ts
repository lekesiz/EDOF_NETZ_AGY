import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, syncLogs } from '@/db/schema';
import { mapWedofToDossier } from '@/lib/wedof';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = process.env.WEDOF_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('x-webhook-secret') 
        || request.headers.get('authorization');
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        console.error('[Webhook WEDOF] Invalid secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse the body
    const body = await request.json();

    // Wedof can send the folder directly or wrapped
    const folder = body.registrationFolder || body.data || body;

    // Must have externalId
    const externalId = folder.externalId || folder.external_id;
    if (!externalId) {
      console.error('[Webhook WEDOF] Invalid payload - missing externalId:', JSON.stringify(body).substring(0, 200));
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

    const eventType = body.event || body.type || 'unknown';
    console.log(`[Webhook WEDOF] ${eventType} - Dossier ${externalId} updated`);

    // Log event in sync_logs
    await db.insert(syncLogs).values({
      syncType: 'wedof',
      status: 'success',
      recordsProcessed: 1,
      recordsCreated: 1,
      recordsUpdated: 0,
      durationMs: 0,
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
