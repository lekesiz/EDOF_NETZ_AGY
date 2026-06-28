import { db } from '@/db/db';
import { dossiers, settings, emailQueue, syncLogs, pennylaneInvoices } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { fetchAllRegistrationFolders, mapWedofToDossier } from './wedof';
import { fetchPaidInvoices } from './pennylane';
import { extractNameFromLabel, normalizeName, nameSimilarity } from './reconciliation';

// Throttling sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Gets a setting value from the database
 */
async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Sets a setting value in the database
 */
async function setSetting(key: string, value: string): Promise<void> {
  try {
    await db.insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() }
      });
  } catch (e) {
    console.error(`[Scheduler] Failed to save setting ${key}:`, e);
  }
}

/**
 * REDOF Sync Job
 */
async function runWedofSyncJob() {
  console.log('[Scheduler] Starting daily WEDOF Sync...');
  const startTime = Date.now();
  try {
    const rawFolders = await fetchAllRegistrationFolders();
    
    // Deduplicate by externalId
    const foldersMap = new Map<string, any>();
    for (const f of rawFolders) {
      const extId = String(f.externalId || '').trim();
      if (!extId) continue;
      const existing = foldersMap.get(extId);
      if (!existing) {
        foldersMap.set(extId, f);
      } else {
        const existingTime = existing.updateDate ? new Date(existing.updateDate).getTime() : 0;
        const currentTime = f.updateDate ? new Date(f.updateDate).getTime() : 0;
        if (currentTime > existingTime) {
          foldersMap.set(extId, f);
        }
      }
    }
    const folders = Array.from(foldersMap.values());

    let success = 0;
    const batchSize = 50;

    for (let i = 0; i < folders.length; i += batchSize) {
      const batch = folders.slice(i, i + batchSize);
      const mappedBatch = batch.map(mapWedofToDossier);

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
    }

    const duration = Date.now() - startTime;
    await db.insert(syncLogs).values({
      syncType: 'wedof',
      status: 'success',
      recordsProcessed: folders.length,
      recordsCreated: success,
      recordsUpdated: 0,
      durationMs: duration,
    });
    console.log(`[Scheduler] WEDOF Sync finished successfully. Processed ${folders.length} records in ${duration}ms`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Scheduler] WEDOF Sync failed:', error.message);
    await db.insert(syncLogs).values({
      syncType: 'wedof',
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
      durationMs: duration,
    });
  }
}

/**
 * Pennylane Sync & Reconciliation Job
 */
async function runPennylaneSyncJob() {
  console.log('[Scheduler] Starting daily Pennylane Sync & Reconciliation...');
  const startTime = Date.now();
  try {
    const rawInvoices = await fetchPaidInvoices();

    // Deduplicate by invoice_number
    const invoicesMap = new Map<string, any>();
    for (const inv of rawInvoices) {
      const invNum = String(inv.invoice_number || '').trim();
      if (!invNum) continue;
      const existing = invoicesMap.get(invNum);
      if (!existing) {
        invoicesMap.set(invNum, inv);
      } else {
        const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        const currentTime = inv.updated_at ? new Date(inv.updated_at).getTime() : 0;
        if (currentTime > existingTime) {
          invoicesMap.set(invNum, inv);
        }
      }
    }
    const invoices = Array.from(invoicesMap.values());

    const BATCH_SIZE = 50;
    const now = new Date();

    for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
      const batch = invoices.slice(i, i + BATCH_SIZE);
      const values = batch.map((inv) => ({
        invoiceNumber: String(inv.invoice_number || ''),
        amount: String(inv.amount || 0),
        paidDate: inv.date || null,
        isPaid: Boolean(inv.paid),
        rawData: inv,
        updatedAt: now,
      }));

      await db.insert(pennylaneInvoices)
        .values(values)
        .onConflictDoUpdate({
          target: pennylaneInvoices.invoiceNumber,
          set: {
            amount: sql`excluded.amount`,
            paidDate: sql`excluded.paid_date`,
            isPaid: sql`excluded.is_paid`,
            rawData: sql`excluded.raw_data`,
            updatedAt: now,
          },
        });
    }

    // Reconciliation engine matching
    let matched = 0;
    const allDossiers = await db.select().from(dossiers);
    if (allDossiers.length > 0) {
      await db.update(dossiers).set({
        pennylaneInvoiceNumber: null,
        pennylanePaidDate: null,
        isReconciled: false,
        updatedAt: now,
      });

      const dossiersByName = new Map<string, typeof allDossiers>();
      for (const d of allDossiers) {
        if (!d.lastName) continue;
        const normalizedLast = normalizeName(d.lastName);
        if (!normalizedLast) continue;
        if (!dossiersByName.has(normalizedLast)) {
          dossiersByName.set(normalizedLast, []);
        }
        dossiersByName.get(normalizedLast)!.push(d);
      }

      const usedDossierIds = new Set<string>();
      const updates: { id: string; invoiceNumber: string; paidDate: string | null }[] = [];

      for (const inv of invoices) {
        if (!inv.paid) continue;
        const invAmount = parseFloat(String(inv.amount));
        const invoiceName = extractNameFromLabel(inv.label || '');

        if (invoiceName) {
          const normalizedInvLastName = normalizeName(invoiceName.lastName);
          const normalizedInvFirstName = normalizeName(invoiceName.firstName);
          let candidates = dossiersByName.get(normalizedInvLastName) || [];

          if (candidates.length === 0) {
            dossiersByName.forEach((dossierList, key) => {
              if (nameSimilarity(normalizedInvLastName, key) >= 0.8) {
                candidates = candidates.concat(dossierList);
              }
            });
          }

          let bestMatch = null;
          let bestScore = 0;

          for (const candidate of candidates) {
            if (usedDossierIds.has(candidate.id)) continue;
            const amountMatch = Math.abs(parseFloat(candidate.amount) - invAmount) <= 1;
            const firstNameMatch = normalizedInvFirstName
              ? nameSimilarity(candidate.firstName || '', normalizedInvFirstName)
              : 0;

            let score = 0.5;
            score += firstNameMatch * 0.3;
            if (amountMatch) score += 0.2;

            if (score > bestScore) {
              bestScore = score;
              bestMatch = candidate;
            }
          }

          if (bestMatch && bestScore >= 0.5) {
            updates.push({
              id: bestMatch.id,
              invoiceNumber: inv.invoice_number || '',
              paidDate: inv.date || null,
            });
            usedDossierIds.add(bestMatch.id);
            matched++;
            continue;
          }
        }

        if (invAmount > 0) {
          const amountCandidates = allDossiers.filter(
            (d) => !usedDossierIds.has(d.id) && Math.abs(parseFloat(d.amount) - invAmount) <= 1
          );
          if (amountCandidates.length === 1) {
            updates.push({
              id: amountCandidates[0].id,
              invoiceNumber: inv.invoice_number || '',
              paidDate: inv.date || null,
            });
            usedDossierIds.add(amountCandidates[0].id);
            matched++;
          }
        }
      }

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((u) =>
            db.update(dossiers)
              .set({
                pennylaneInvoiceNumber: u.invoiceNumber,
                pennylanePaidDate: u.paidDate,
                isReconciled: true,
                updatedAt: now,
              })
              .where(eq(dossiers.id, u.id))
          )
        );
      }
    }

    const duration = Date.now() - startTime;
    await db.insert(syncLogs).values({
      syncType: 'pennylane',
      status: 'success',
      recordsProcessed: invoices.length,
      recordsCreated: matched,
      recordsUpdated: 0,
      durationMs: duration,
    });
    console.log(`[Scheduler] Pennylane Sync finished. Matched ${matched} dossiers in ${duration}ms`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Scheduler] Pennylane Sync failed:', error.message);
    await db.insert(syncLogs).values({
      syncType: 'pennylane',
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
      durationMs: duration,
    });
  }
}

/**
 * Billing Loop automation trigger
 */
async function runBillingJob() {
  console.log('[Scheduler] Starting Billing Loop Job...');
  try {
    const cronSecret = process.env.CRON_SECRET || 'edof-cron-secret-2026';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/cron/billing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      }
    });

    const data = await response.json();
    console.log('[Scheduler] Billing Loop results:', JSON.stringify(data));
  } catch (error: any) {
    console.error('[Scheduler] Billing Loop Job trigger error:', error.message);
  }
}

/**
 * Email Queue Daily Generation Job
 */
async function generateEmailQueueJob() {
  console.log('[Scheduler] Generating daily e-mail queues...');
  try {
    const allDossiers = await db.select().from(dossiers);
    const today = new Date();
    const todayMMDD = today.toISOString().substring(5, 10);
    const currentYear = today.getFullYear();
    const startOfCurrentYear = new Date(`${currentYear}-01-01T00:00:00Z`);

    let queuedBDay = 0;
    let queuedSurvey1 = 0;
    let queuedSurvey6 = 0;

    for (const d of allDossiers) {
      if (!d.email) continue;

      // 1. Birthday Check
      if (d.dob) {
        const dobMMDD = d.dob.substring(5, 10);
        if (dobMMDD === todayMMDD) {
          // Check if already queued/sent this year
          const [exists] = await db.select()
            .from(emailQueue)
            .where(
              and(
                eq(emailQueue.dossierId, d.id),
                eq(emailQueue.emailType, 'bday'),
                gte(emailQueue.createdAt, startOfCurrentYear)
              )
            ).limit(1);

          if (!exists) {
            await db.insert(emailQueue).values({
              dossierId: d.id,
              email: d.email,
              emailType: 'bday',
              status: 'pending',
              scheduledFor: new Date(),
            });
            queuedBDay++;
          }
        }
      }

      // 2. Satisfaction Surveys Check (only if paid/reconciled)
      if (d.isReconciled && d.endDate) {
        const endDateVal = new Date(d.endDate + 'T00:00:00Z');
        const diffMs = Date.now() - endDateVal.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Survey J+1: exactly 1 day after end date
        if (diffDays === 1) {
          const [exists] = await db.select()
            .from(emailQueue)
            .where(
              and(
                eq(emailQueue.dossierId, d.id),
                eq(emailQueue.emailType, 'survey1')
              )
            ).limit(1);

          if (!exists) {
            await db.insert(emailQueue).values({
              dossierId: d.id,
              email: d.email,
              emailType: 'survey1',
              status: 'pending',
              scheduledFor: new Date(),
            });
            queuedSurvey1++;
          }
        }

        // Survey M+6: around 180 days (between 180 and 181 days to avoid missing)
        if (diffDays === 180) {
          const [exists] = await db.select()
            .from(emailQueue)
            .where(
              and(
                eq(emailQueue.dossierId, d.id),
                eq(emailQueue.emailType, 'survey6')
              )
            ).limit(1);

          if (!exists) {
            await db.insert(emailQueue).values({
              dossierId: d.id,
              email: d.email,
              emailType: 'survey6',
              status: 'pending',
              scheduledFor: new Date(),
            });
            queuedSurvey6++;
          }
        }
      }
    }

    console.log(`[Scheduler] Email Queue generated. Birthdays: ${queuedBDay}, Survey J+1: ${queuedSurvey1}, Survey M+6: ${queuedSurvey6}`);
  } catch (error: any) {
    console.error('[Scheduler] E-mail Queue generation failed:', error.message);
  }
}

/**
 * Main scheduler loop, checked every 5 minutes
 */
async function checkAndTriggerJobs() {
  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0]; // e.g., '2026-06-28'
  const currentHourUTC = now.getUTCHours();

  console.log(`[Scheduler] Pulse check at UTC hour ${currentHourUTC}`);

  // 1. WEDOF Sync (06:00 UTC)
  if (currentHourUTC >= 6) {
    const lastRun = await getSetting('last_run_sync_wedof');
    if (lastRun !== todayDateStr) {
      await setSetting('last_run_sync_wedof', todayDateStr);
      await runWedofSyncJob();
    }
  }

  // 2. Pennylane Sync (07:00 UTC)
  if (currentHourUTC >= 7) {
    const lastRun = await getSetting('last_run_sync_pennylane');
    if (lastRun !== todayDateStr) {
      await setSetting('last_run_sync_pennylane', todayDateStr);
      await runPennylaneSyncJob();
    }
  }

  // 3. Billing Loop (08:00 UTC)
  if (currentHourUTC >= 8) {
    const lastRun = await getSetting('last_run_billing');
    if (lastRun !== todayDateStr) {
      await setSetting('last_run_billing', todayDateStr);
      await runBillingJob();
    }
  }

  // 4. Email Outbox Generator (09:00 UTC)
  if (currentHourUTC >= 9) {
    const lastRun = await getSetting('last_run_email_queue');
    if (lastRun !== todayDateStr) {
      await setSetting('last_run_email_queue', todayDateStr);
      await generateEmailQueueJob();
    }
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function initBackgroundScheduler() {
  if (process.env.SKIP_SCHEDULER === 'true') {
    console.log('[Scheduler] Background Scheduler disabled via SKIP_SCHEDULER environment variable.');
    return;
  }

  if (schedulerInterval) {
    console.log('[Scheduler] Background Scheduler already running.');
    return;
  }

  console.log('[Scheduler] Initializing Background Scheduler...');
  
  // Run checks immediately on start, then every 5 minutes
  checkAndTriggerJobs().catch(console.error);

  schedulerInterval = setInterval(() => {
    checkAndTriggerJobs().catch(console.error);
  }, 5 * 60 * 1000); // 5 minutes
}
