import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, settings, syncLogs } from '@/db/schema';
import { computeDashboardStats, computeMonthlyData } from '@/lib/financial-engine';
import { eq, and, gte, lt, isNotNull, desc } from 'drizzle-orm';
import type { DashboardResponse, Dossier } from '@/types';

export const dynamic = 'force-dynamic';

const DEFAULT_TARGETS: Record<number, number> = {
  2025: 1000000,
  2026: 2000000,
  2027: 4000000,
};

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // 2. Fetch settings
    const [targetSetting] = await db.select().from(settings).where(eq(settings.key, `target_${year}`));
    const [prevTargetSetting] = await db.select().from(settings).where(eq(settings.key, `target_${year - 1}`));
    const [vadeGunSetting] = await db.select().from(settings).where(eq(settings.key, 'vade_gun'));

    const vadeGun = vadeGunSetting?.value ? Number(vadeGunSetting.value) : 37;

    // 3. Date ranges based on due date: due_date = end_date + vadeGun days
    const startFilter = new Date(year, 0, 1);
    startFilter.setDate(startFilter.getDate() - vadeGun);
    const endFilter = new Date(year + 1, 0, 1);
    endFilter.setDate(endFilter.getDate() - vadeGun);

    const startStr = startFilter.toISOString().split('T')[0];
    const endStr = endFilter.toISOString().split('T')[0];

    // Fetch dossiers falling in this year's due date range
    const dbDossiers = await db.select()
      .from(dossiers)
      .where(
        and(
          isNotNull(dossiers.endDate),
          gte(dossiers.endDate, startStr),
          lt(dossiers.endDate, endStr)
        )
      );

    // Map db schema back to frontend types (amount string to number)
    const typedDossiers: Dossier[] = dbDossiers.map(d => ({
      id: d.id,
      external_id: d.externalId,
      first_name: d.firstName,
      last_name: d.lastName,
      dob: d.dob,
      email: d.email,
      phone: d.phone,
      training_title: d.trainingTitle,
      start_date: d.startDate,
      end_date: d.endDate,
      wedof_status: d.wedofStatus,
      amount: parseFloat(d.amount),
      wedof_paid_date: d.wedofPaidDate,
      pennylane_paid_date: d.pennylanePaidDate,
      pennylane_invoice_number: d.pennylaneInvoiceNumber,
      is_reconciled: d.isReconciled,
      raw_data: d.rawData as Record<string, unknown> | null,
      created_at: d.createdAt.toISOString(),
      updated_at: d.updatedAt.toISOString(),
    }));

    // Compute stats
    const stats = computeDashboardStats(typedDossiers, year, vadeGun);

    // Override target with database values or default values
    stats.targetAmount = targetSetting?.value ? Number(targetSetting.value) : (DEFAULT_TARGETS[year] || 1000000);

    // Compute monthly chart data
    const monthlyData = computeMonthlyData(typedDossiers, year, vadeGun);

    // Compute previous year total
    const prevStartFilter = new Date(year - 1, 0, 1);
    prevStartFilter.setDate(prevStartFilter.getDate() - vadeGun);
    const prevEndFilter = new Date(year, 0, 1);
    prevEndFilter.setDate(prevEndFilter.getDate() - vadeGun);

    const prevDbDossiers = await db.select({
      amount: dossiers.amount,
      wedofStatus: dossiers.wedofStatus,
      isReconciled: dossiers.isReconciled,
      wedofPaidDate: dossiers.wedofPaidDate,
      pennylanePaidDate: dossiers.pennylanePaidDate,
      endDate: dossiers.endDate,
    })
      .from(dossiers)
      .where(
        and(
          isNotNull(dossiers.endDate),
          gte(dossiers.endDate, prevStartFilter.toISOString().split('T')[0]),
          lt(dossiers.endDate, prevEndFilter.toISOString().split('T')[0])
        )
      );

    if (prevDbDossiers) {
      // Map subset to Dossier for stats calculation
      const mappedPrev: Dossier[] = prevDbDossiers.map(d => ({
        id: '',
        external_id: '',
        first_name: null,
        last_name: null,
        dob: null,
        email: null,
        phone: null,
        training_title: null,
        start_date: null,
        end_date: d.endDate,
        wedof_status: d.wedofStatus,
        amount: parseFloat(d.amount),
        wedof_paid_date: d.wedofPaidDate,
        pennylane_paid_date: d.pennylanePaidDate,
        pennylane_invoice_number: null,
        is_reconciled: d.isReconciled,
        raw_data: null,
        created_at: '',
        updated_at: '',
      }));

      const prevStats = computeDashboardStats(mappedPrev, year - 1, vadeGun);
      stats.previousYearTotal = prevTargetSetting?.value 
        ? Number(prevTargetSetting.value) 
        : (DEFAULT_TARGETS[year - 1] || (prevStats.kasa + prevStats.invoicedPending));
    }

    // Get last sync times
    const [lastWedofSync] = await db.select({ createdAt: syncLogs.createdAt })
      .from(syncLogs)
      .where(and(eq(syncLogs.syncType, 'wedof'), eq(syncLogs.status, 'success')))
      .orderBy(desc(syncLogs.createdAt))
      .limit(1);

    const [lastPennylaneSync] = await db.select({ createdAt: syncLogs.createdAt })
      .from(syncLogs)
      .where(and(eq(syncLogs.syncType, 'pennylane'), eq(syncLogs.status, 'success')))
      .orderBy(desc(syncLogs.createdAt))
      .limit(1);

    const response: DashboardResponse = {
      stats,
      monthlyData,
      lastSync: {
        wedof: lastWedofSync?.createdAt ? lastWedofSync.createdAt.toISOString() : null,
        pennylane: lastPennylaneSync?.createdAt ? lastPennylaneSync.createdAt.toISOString() : null,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
