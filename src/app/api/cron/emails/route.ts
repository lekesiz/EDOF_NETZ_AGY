import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { emailQueue } from '@/db/schema';
import { and, eq, lte } from 'drizzle-orm';
import { processQueueItem } from '@/lib/emails';
import { detectSource, logActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes limit on Vercel Pro

const EMAIL_SEND_DELAY_MS = 600; // delay to prevent Resend rate limits
const MAX_PROCESS_PER_RUN = 50;  // process in small batches to avoid timeouts

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

  try {
    const now = new Date();
    
    // Select pending items scheduled for now or earlier
    const pendingItems = await db.select({
      id: emailQueue.id,
      email: emailQueue.email,
      emailType: emailQueue.emailType,
      dossierId: emailQueue.dossierId,
    })
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, 'pending'),
        lte(emailQueue.scheduledFor, now)
      )
    )
    .orderBy(emailQueue.scheduledFor)
    .limit(MAX_PROCESS_PER_RUN);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        pendingCount: pendingItems.length,
        items: pendingItems.map(item => ({
          id: item.id,
          email: item.email,
          type: item.emailType,
          dossierId: item.dossierId,
        }))
      });
    }

    let sent = 0;
    let failures = 0;
    const errors: string[] = [];

    for (const item of pendingItems) {
      try {
        // Add a small delay between Resend calls to avoid rate limiting
        if (sent > 0 || failures > 0) {
          await new Promise((resolve) => setTimeout(resolve, EMAIL_SEND_DELAY_MS));
        }

        await processQueueItem(item.id);
        sent++;
      } catch (err: any) {
        failures++;
        errors.push(`ID ${item.id} (${item.email}): ${err.message || 'Unknown error'}`);
      }
    }

    const duration = Date.now() - startTime;
    
    // Log activity
    await logActivity({
      syncType: 'emails_kuyruk',
      status: failures > 0 ? 'partial' : 'success',
      source,
      recordsProcessed: pendingItems.length,
      recordsCreated: sent,
      recordsUpdated: failures,
      detail: errors.length > 0 ? errors.slice(0, 5).join('; ') : `Kuyruktaki ${sent} e-posta başarıyla gönderildi.`,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      processed: pendingItems.length,
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
        syncType: 'emails_kuyruk',
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
