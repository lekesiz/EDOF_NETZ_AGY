import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, syncLogs } from '@/db/schema';
import { fetchAllRegistrationFolders, mapWedofToDossier } from '@/lib/wedof';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Railway/Vercel Pro

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all folders from WEDOF
    const folders = await fetchAllRegistrationFolders();
    let success = 0;
    let errors = 0;

    // Process in batches of 50 using upsert
    const batchSize = 50;
    for (let i = 0; i < folders.length; i += batchSize) {
      const batch = folders.slice(i, i + batchSize);
      const mappedBatch = batch.map(mapWedofToDossier);

      try {
        await db.insert(dossiers)
          .values(mappedBatch)
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
        success += batch.length;
      } catch (err: any) {
        console.error(`Batch ${i / batchSize + 1} error:`, err.message);
        errors += batch.length;
      }
    }

    const duration = Date.now() - startTime;

    // Log sync result
    await db.insert(syncLogs).values({
      syncType: 'wedof',
      status: 'success',
      recordsProcessed: folders.length,
      recordsCreated: success,
      recordsUpdated: 0,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      processed: folders.length,
      upserted: success,
      errors,
      duration_ms: duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown error';

    await db.insert(syncLogs).values({
      syncType: 'wedof',
      status: 'failed',
      errorMessage,
      durationMs: duration,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET for triggering via simple web/cron requests
export async function GET(request: NextRequest) {
  return POST(request);
}
