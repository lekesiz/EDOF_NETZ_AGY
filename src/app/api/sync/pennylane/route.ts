import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, pennylaneInvoices, syncLogs } from '@/db/schema';
import { fetchPaidInvoices } from '@/lib/pennylane';
import { extractNameFromLabel, normalizeName, nameSimilarity } from '@/lib/reconciliation';
import { sql, eq } from 'drizzle-orm';

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

    // 1. Fetch all paid invoices from Pennylane
    const invoices = await fetchPaidInvoices();

    // 2. Cache invoices in the pennylane_invoices table (upsert in batches of 50)
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

    // 3. Fetch all dossiers with amount > 0
    const allDossiers = await db.select().from(dossiers);

    if (allDossiers.length === 0) {
      return NextResponse.json({ success: true, message: 'No dossiers found in database', matched: 0 });
    }

    // 4. Reset all existing reconciliations to clean slate before re-matching
    await db.update(dossiers).set({
      pennylaneInvoiceNumber: null,
      pennylanePaidDate: null,
      isReconciled: false,
      updatedAt: now,
    });

    // 5. Index dossiers by normalized last name for fast lookups
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

    // 6. Match invoices with dossiers
    let matched = 0;
    let matchedByName = 0;
    let matchedByAmount = 0;
    const usedDossierIds = new Set<string>();
    const updates: { id: string; invoiceNumber: string; paidDate: string | null }[] = [];

    for (const inv of invoices) {
      if (!inv.paid) continue;
      const invAmount = parseFloat(String(inv.amount));

      // Extract client name from label
      const invoiceName = extractNameFromLabel(inv.label || '');

      if (invoiceName) {
        const normalizedInvLastName = normalizeName(invoiceName.lastName);
        const normalizedInvFirstName = normalizeName(invoiceName.firstName);

        // Find by exact last name match
        let candidates = dossiersByName.get(normalizedInvLastName) || [];

        // If no exact match, search by similarity
        if (candidates.length === 0) {
          dossiersByName.forEach((dossierList, key) => {
            if (nameSimilarity(normalizedInvLastName, key) >= 0.8) {
              candidates = candidates.concat(dossierList);
            }
          });
        }

        // Filter candidates by name and amount (1€ tolerance)
        let bestMatch = null;
        let bestScore = 0;

        for (const candidate of candidates) {
          if (usedDossierIds.has(candidate.id)) continue;

          const amountMatch = Math.abs(parseFloat(candidate.amount) - invAmount) <= 1;
          const firstNameMatch = normalizedInvFirstName
            ? nameSimilarity(candidate.firstName || '', normalizedInvFirstName)
            : 0;

          // Score: family name (pre-filtered) + first name (max 0.3) + amount match (0.2)
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
          matchedByName++;
          continue;
        }
      }

      // Fallback: match by amount alone (only if exactly 1 candidate exists with this amount)
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
          matchedByAmount++;
        }
      }
    }

    // 7. Apply updates to the database in parallel batches of 50
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

    const duration = Date.now() - startTime;

    // Log success
    await db.insert(syncLogs).values({
      syncType: 'pennylane',
      status: 'success',
      recordsProcessed: invoices.length,
      recordsCreated: matched,
      recordsUpdated: 0,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      invoices_fetched: invoices.length,
      matched,
      matched_by_name: matchedByName,
      matched_by_amount_only: matchedByAmount,
      total_dossiers: allDossiers.length,
      duration_ms: duration,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown error';

    await db.insert(syncLogs).values({
      syncType: 'pennylane',
      status: 'failed',
      errorMessage,
      durationMs: duration,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET for manual triggering
export async function GET(request: NextRequest) {
  return POST(request);
}
