import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { emailQueue, dossiers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { processQueueItem } from '@/lib/emails';

export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve all queued emails joined with student details
 */
export async function GET(request: NextRequest) {
  try {
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const results = await db.select({
      id: emailQueue.id,
      dossierId: emailQueue.dossierId,
      email: emailQueue.email,
      emailType: emailQueue.emailType,
      status: emailQueue.status,
      errorMessage: emailQueue.errorMessage,
      scheduledFor: emailQueue.scheduledFor,
      createdAt: emailQueue.createdAt,
      sentAt: emailQueue.sentAt,
      firstName: dossiers.firstName,
      lastName: dossiers.lastName,
      trainingTitle: dossiers.trainingTitle,
    })
    .from(emailQueue)
    .leftJoin(dossiers, eq(emailQueue.dossierId, dossiers.id))
    .orderBy(desc(emailQueue.createdAt));

    const formattedQueue = results.map(q => ({
      id: q.id,
      dossier_id: q.dossierId,
      email: q.email,
      email_type: q.emailType,
      status: q.status,
      error_message: q.errorMessage,
      scheduled_for: q.scheduledFor.toISOString(),
      created_at: q.createdAt.toISOString(),
      sent_at: q.sentAt ? q.sentAt.toISOString() : null,
      firstName: q.firstName,
      lastName: q.lastName,
      trainingTitle: q.trainingTitle,
    }));

    return NextResponse.json({ queue: formattedQueue });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Approve/Send or Cancel a queued email
 */
export async function POST(request: NextRequest) {
  try {
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { action, id } = await request.json();

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    }

    if (action === 'approve') {
      console.log(`[Queue API] Approving and sending queued email ID: ${id}`);
      const resendId = await processQueueItem(id);
      return NextResponse.json({ success: true, resend_id: resendId });
    }

    if (action === 'cancel') {
      console.log(`[Queue API] Cancelling queued email ID: ${id}`);
      await db.update(emailQueue)
        .set({ status: 'cancelled' })
        .where(eq(emailQueue.id, id));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error(`[Queue API] Error performing action:`, error.message);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
