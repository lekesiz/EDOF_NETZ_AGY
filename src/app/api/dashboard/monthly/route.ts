import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, settings } from '@/db/schema';
import { eq, and, gte, lt, isNotNull, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const CANCEL_KEYWORDS = ['cancel', 'refus', 'reject', 'annul', 'abandon'];

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const userEmail = await validateSession();
    if (!userEmail) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // "2026-05"
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    // 2. Fetch vade_gun setting
    const [vadeGunSetting] = await db.select().from(settings).where(eq(settings.key, 'vade_gun'));
    const vadeGun = vadeGunSetting?.value ? Number(vadeGunSetting.value) : 37;

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);

    // Calculate end_date range that maps to this vade month
    // vade_tarihi = end_date + vadeGun days
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 1);

    const endDateStart = new Date(monthStart);
    endDateStart.setDate(endDateStart.getDate() - vadeGun);
    const endDateEnd = new Date(monthEnd);
    endDateEnd.setDate(endDateEnd.getDate() - vadeGun);

    const startStr = endDateStart.toISOString().split('T')[0];
    const endStr = endDateEnd.toISOString().split('T')[0];

    // Fetch matching dossiers ordered by end_date
    const dbDossiers = await db.select({
      id: dossiers.id,
      externalId: dossiers.externalId,
      firstName: dossiers.firstName,
      lastName: dossiers.lastName,
      email: dossiers.email,
      trainingTitle: dossiers.trainingTitle,
      startDate: dossiers.startDate,
      endDate: dossiers.endDate,
      wedofStatus: dossiers.wedofStatus,
      amount: dossiers.amount,
      isReconciled: dossiers.isReconciled,
      pennylaneInvoiceNumber: dossiers.pennylaneInvoiceNumber,
    })
      .from(dossiers)
      .where(
        and(
          isNotNull(dossiers.endDate),
          gte(dossiers.endDate, startStr),
          lt(dossiers.endDate, endStr)
        )
      )
      .orderBy(asc(dossiers.endDate));

    // Enrich and categorize
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enrichedDossiers = dbDossiers.map((d) => {
      const endDate = d.endDate ? new Date(d.endDate) : null;
      const vadeTarihi = endDate ? new Date(endDate.getTime() + vadeGun * 24 * 60 * 60 * 1000) : null;
      
      let kategori: 'kasa' | 'alacak' | 'kayip' = 'alacak';
      const status = (d.wedofStatus || '').toLowerCase();
      
      if (CANCEL_KEYWORDS.some(kw => status.includes(kw))) {
        kategori = 'kayip';
      } else if (vadeTarihi && vadeTarihi <= today) {
        kategori = 'kasa';
      } else {
        kategori = 'alacak';
      }

      return {
        id: d.id,
        external_id: d.externalId,
        first_name: d.firstName,
        last_name: d.lastName,
        email: d.email,
        training_title: d.trainingTitle,
        start_date: d.startDate,
        end_date: d.endDate,
        wedof_status: d.wedofStatus,
        amount: parseFloat(d.amount),
        is_reconciled: d.isReconciled,
        pennylane_invoice_number: d.pennylaneInvoiceNumber,
        vade_tarihi: vadeTarihi ? vadeTarihi.toISOString().split('T')[0] : null,
        kategori,
      };
    });

    // Filter only dossiers whose computed vade date falls in this month
    const filtered = enrichedDossiers.filter((d) => {
      if (!d.vade_tarihi) return false;
      return d.vade_tarihi.startsWith(month);
    });

    // Sort by computed due date
    filtered.sort((a, b) => (a.vade_tarihi || '').localeCompare(b.vade_tarihi || ''));

    // Group by day for daily summary on the modal charts
    const dailySummary: Record<string, { kasa: number; alacak: number; kayip: number; count: number }> = {};
    
    for (const d of filtered) {
      const day = d.vade_tarihi || 'unknown';
      if (!dailySummary[day]) {
        dailySummary[day] = { kasa: 0, alacak: 0, kayip: 0, count: 0 };
      }
      const amount = d.amount || 0;
      dailySummary[day][d.kategori] += amount;
      dailySummary[day].count++;
    }

    const dailyData = Object.entries(dailySummary)
      .map(([date, values]) => ({
        date,
        ...values,
        total: values.kasa + values.alacak,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Compute totals
    const totals = {
      kasa: filtered.filter(d => d.kategori === 'kasa').reduce((s, d) => s + (d.amount || 0), 0),
      alacak: filtered.filter(d => d.kategori === 'alacak').reduce((s, d) => s + (d.amount || 0), 0),
      kayip: filtered.filter(d => d.kategori === 'kayip').reduce((s, d) => s + (d.amount || 0), 0),
      total: filtered.filter(d => d.kategori !== 'kayip').reduce((s, d) => s + (d.amount || 0), 0),
      count: filtered.length,
    };

    return NextResponse.json({
      month,
      vadeGun,
      totals,
      dailyData,
      dossiers: filtered,
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
