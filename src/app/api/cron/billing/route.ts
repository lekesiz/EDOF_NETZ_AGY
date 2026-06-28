import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, billingLogs, syncLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  fetchDossiersToBill,
  createPennylaneInvoice,
  notifyWedofBilling,
  notifyWedofServiceDone,
  sendBillingNotificationEmail,
  logBillingStep,
  BillingDossier,
  BillingResult,
} from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Railway/Vercel Pro

// Map a raw Wedof folder to BillingDossier
function mapToBillingDossier(folder: Record<string, any>): BillingDossier {
  const attendee = (folder.attendee as Record<string, any>) || {};
  const trainingActionInfo = (folder.trainingActionInfo as Record<string, any>) || {};

  const startDate = (trainingActionInfo.sessionStartDate as string)?.split('T')[0] ?? null;
  const endDate = (trainingActionInfo.sessionEndDate as string)?.split('T')[0] ?? null;

  const amount =
    (folder.amountToInvoice as number) ||
    (trainingActionInfo.totalIncl as number) ||
    (trainingActionInfo.totalExcl as number) ||
    0;

  return {
    external_id: String(folder.externalId || ''),
    first_name: String(attendee.firstName || '') || null,
    last_name: String(attendee.lastName || '') || null,
    email: String(attendee.email || '') || null,
    phone: String(attendee.phoneNumber || '') || null,
    training_title: String(trainingActionInfo.title || '') || null,
    start_date: startDate,
    end_date: endDate,
    amount,
    raw_data: folder,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Auth check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wedofApiKey = process.env.WEDOF_API_KEY;
  const pennylaneToken = process.env.PENNYLANE_API_TOKEN;

  if (!wedofApiKey || !pennylaneToken) {
    return NextResponse.json(
      { error: 'Missing WEDOF_API_KEY or PENNYLANE_API_TOKEN environment variables' },
      { status: 500 }
    );
  }

  const results: BillingResult[] = [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // ── Step 1: Fetch all dossiers ready to bill from Wedof ──────────────────
    const fetchStart = new Date();
    const rawFolders = await fetchDossiersToBill(wedofApiKey);
    processed = rawFolders.length;

    if (processed === 0) {
      const duration = Date.now() - startTime;
      await logBillingRun(0, 0, 0, duration, null);
      return NextResponse.json({
        success: true,
        message: 'No dossiers to bill',
        processed: 0,
        succeeded: 0,
        failed: 0,
        duration_ms: duration,
        results: [],
      });
    }

    const runId = crypto.randomUUID();

    // ── Step 2: Process each dossier ─────────────────────────────────────────
    for (const rawFolder of rawFolders) {
      const dossier = mapToBillingDossier(rawFolder);
      const result: BillingResult = { external_id: dossier.external_id, success: false };
      const dossierStart = new Date();

      // Create billing_log entry (pending)
      const [logEntry] = await db.insert(billingLogs).values({
        runId,
        dossierExternalId: dossier.external_id,
        dossierFirstName: dossier.first_name,
        dossierLastName: dossier.last_name,
        amount: String(dossier.amount),
        status: 'pending',
        triggeredBy: 'cron',
        createdAt: dossierStart,
      }).returning({ id: billingLogs.id });

      const billingLogId = logEntry?.id;
      const ctx = billingLogId
        ? { billingLogId, dossierExternalId: dossier.external_id }
        : undefined;

      // Log step 1: wedof_fetch_dossier (already done in batch, log as success)
      if (ctx) {
        await logBillingStep(
          ctx, 'wedof_fetch', 1, 'success', fetchStart,
          { billing_state: 'toBill', state: 'serviceDoneValidated' },
          {
            external_id: dossier.external_id,
            billing_state: rawFolder.billingState,
            state: rawFolder.state,
            amount_to_invoice: rawFolder.amountToInvoice,
            attendee_name: `${dossier.first_name || ''} ${dossier.last_name || ''}`.trim(),
          }
        );
      }

      try {
        // ── Step 2 & 3: Create Pennylane invoice (2026 API) ─────────────────────
        result.step = 'create_invoice';
        const { invoiceNumber, invoiceId } = await createPennylaneInvoice(
          dossier,
          pennylaneToken,
          ctx
        );
        result.invoice_number = invoiceNumber;
        result.pennylane_invoice_id = invoiceId;

        // ── Step 4: Notify Wedof — mark dossier as billed ──────────────────
        result.step = 'notify_wedof';
        await notifyWedofBilling(dossier.external_id, invoiceNumber, wedofApiKey, ctx);

        // ── Step 5: Wedof — Service fait déclaré ───────────────────────────
        result.step = 'service_done';
        try {
          await notifyWedofServiceDone(dossier.external_id, wedofApiKey, ctx);
        } catch (serviceDoneErr) {
          console.error(
            `[Billing Cron] serviceDone failed for ${dossier.external_id} (non-blocking):`,
            serviceDoneErr
          );
        }

        // ── Step 6: Gmail/SMTP notification ─────────────────────────────────
        result.step = 'gmail_notification';
        await sendBillingNotificationEmail(dossier, invoiceNumber, ctx);

        // ── Step 7: Update Supabase / Postgres dossier ──────────────────────
        const step7Start = new Date();
        await db.update(dossiers)
          .set({
            pennylaneInvoiceNumber: invoiceNumber,
            wedofStatus: 'billed',
            updatedAt: new Date(),
          })
          .where(eq(dossiers.externalId, dossier.external_id));

        if (ctx) {
          await logBillingStep(
            ctx, 'supabase_update', 6, 'success', step7Start,
            { external_id: dossier.external_id, invoice_number: invoiceNumber },
            { updated: true }
          );
        }

        // Finalize billing_log as success
        if (billingLogId) {
          await db.update(billingLogs).set({
            pennylaneInvoiceNumber: invoiceNumber,
            pennylaneInvoiceId: invoiceId,
            status: 'success',
            errorMessage: null,
            durationMs: Date.now() - dossierStart.getTime(),
          }).where(eq(billingLogs.id, billingLogId));
        }

        result.success = true;
        result.step = undefined;
        succeeded++;

      } catch (err: any) {
        const errorMessage = err.message || String(err);
        result.error = errorMessage;
        result.success = false;
        failed++;

        // Finalize billing_log as failed
        if (billingLogId) {
          await db.update(billingLogs).set({
            pennylaneInvoiceNumber: result.invoice_number || null,
            pennylaneInvoiceId: result.pennylane_invoice_id || null,
            status: 'failed',
            errorMessage,
            failedStep: result.step || null,
            durationMs: Date.now() - dossierStart.getTime(),
          }).where(eq(billingLogs.id, billingLogId));
        }

        console.error(`Billing failed for dossier ${dossier.external_id}:`, errorMessage);
      }

      results.push(result);

      // Throttling: sleep 500ms between dossiers to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const duration = Date.now() - startTime;
    await logBillingRun(processed, succeeded, failed, duration, null);

    return NextResponse.json({
      success: true,
      processed,
      succeeded,
      failed,
      duration_ms: duration,
      results,
    });

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    const duration = Date.now() - startTime;
    await logBillingRun(processed, succeeded, failed, duration, errorMessage);

    console.error('Billing cron fatal error:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage, processed, succeeded, failed },
      { status: 500 }
    );
  }
}

// Helper: Log billing run to sync_logs
async function logBillingRun(
  processed: number,
  succeeded: number,
  failed: number,
  duration: number,
  errorMessage: string | null
) {
  try {
    await db.insert(syncLogs).values({
      syncType: 'billing',
      status: errorMessage ? 'failed' : 'success',
      recordsProcessed: processed,
      recordsCreated: succeeded,
      recordsUpdated: 0,
      errorMessage,
      durationMs: duration,
    });
  } catch (e) {
    console.error('Failed to log billing run:', e);
  }
}

// GET for manual triggering
export async function GET(request: NextRequest) {
  return POST(request);
}
