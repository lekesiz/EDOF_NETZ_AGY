import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { billingLogs, billingStepLogs } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const logId = searchParams.get('logId');

    // If a specific log ID is requested, return the log with its detailed steps
    if (logId) {
      const [log] = await db.select().from(billingLogs).where(eq(billingLogs.id, logId));
      if (!log) {
        return NextResponse.json({ error: 'Audit log introuvable' }, { status: 404 });
      }

      const steps = await db.select()
        .from(billingStepLogs)
        .where(eq(billingStepLogs.billingLogId, logId))
        .orderBy(billingStepLogs.stepOrder);

      return NextResponse.json({ log, steps });
    }

    // Otherwise, return paginated list of all logs
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) {
      conditions.push(eq(billingLogs.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total
    const [countResult] = await db.select({ total: count() }).from(billingLogs).where(whereClause);
    const total = countResult?.total || 0;

    // Get logs
    const logs = await db.select()
      .from(billingLogs)
      .where(whereClause)
      .orderBy(desc(billingLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const formattedLogs = logs.map(l => ({
      id: l.id,
      run_id: l.runId,
      dossier_external_id: l.dossierExternalId,
      dossier_first_name: l.dossierFirstName,
      dossier_last_name: l.dossierLastName,
      amount: l.amount ? parseFloat(l.amount) : 0,
      pennylane_invoice_number: l.pennylaneInvoiceNumber,
      pennylane_invoice_id: l.pennylaneInvoiceId,
      status: l.status,
      error_message: l.errorMessage,
      failed_step: l.failedStep,
      triggered_by: l.triggeredBy,
      duration_ms: l.durationMs,
      created_at: l.createdAt.toISOString(),
    }));

    return NextResponse.json({
      logs: formattedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
