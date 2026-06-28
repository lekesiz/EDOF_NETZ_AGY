import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers } from '@/db/schema';
import { eq, or, and, ilike, inArray, notInArray, isNull, isNotNull, desc, asc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 25;

const CANCELLED_STATUSES = [
  'canceledByAttendee',
  'canceledByAttendeeNotRealized',
  'canceledByFinancer',
  'canceledByOrganism',
  'refusedByOrganism',
  'refusedByAttendee',
  'rejected',
  'rejectedWithoutTitulaireSuite',
];

const SORT_FIELD_MAP: Record<string, any> = {
  external_id: dossiers.externalId,
  name: dossiers.lastName,
  email: dossiers.email,
  training: dossiers.trainingTitle,
  date: dossiers.startDate,
  amount: dossiers.amount,
  status: dossiers.wedofStatus,
  invoice: dossiers.pennylaneInvoiceNumber,
};

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE))));
    const search = searchParams.get('search')?.trim() || '';
    const statusCategory = searchParams.get('statusCategory') || 'all';
    const sortField = searchParams.get('sortField') || 'date';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // 2. Build where conditions
    const conditions = [];

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(dossiers.firstName, searchPattern),
          ilike(dossiers.lastName, searchPattern),
          ilike(dossiers.email, searchPattern),
          ilike(dossiers.externalId, searchPattern),
          ilike(dossiers.trainingTitle, searchPattern)
        )
      );
    }

    if (statusCategory === 'cancelled') {
      conditions.push(inArray(dossiers.wedofStatus, CANCELLED_STATUSES));
    } else if (statusCategory === 'paid') {
      conditions.push(
        and(
          notInArray(dossiers.wedofStatus, CANCELLED_STATUSES),
          or(
            inArray(dossiers.wedofStatus, ['serviceDoneValidated', 'serviceDoneDeclared']),
            eq(dossiers.isReconciled, true),
            isNotNull(dossiers.pennylanePaidDate),
            isNotNull(dossiers.wedofPaidDate)
          )
        )
      );
    } else if (statusCategory === 'pending') {
      conditions.push(
        and(
          notInArray(dossiers.wedofStatus, CANCELLED_STATUSES),
          notInArray(dossiers.wedofStatus, ['serviceDoneValidated', 'serviceDoneDeclared']),
          eq(dossiers.isReconciled, false),
          isNull(dossiers.pennylanePaidDate),
          isNull(dossiers.wedofPaidDate)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 3. Get total count
    const [countResult] = await db.select({ total: count() }).from(dossiers).where(whereClause);
    const total = countResult?.total || 0;

    // 4. Get sorted and paginated records
    const sortColumn = SORT_FIELD_MAP[sortField] || dossiers.createdAt;
    const sortOrder = sortDirection === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const offset = (page - 1) * pageSize;

    const results = await db.select()
      .from(dossiers)
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(pageSize)
      .offset(offset);

    // Map database models to front-end types
    const mappedDossiers = results.map(d => ({
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
      pennylane_paid_date: d.pennylanePaidDate,
      wedof_paid_date: d.wedofPaidDate,
      created_at: d.createdAt.toISOString(),
    }));

    return NextResponse.json({
      dossiers: mappedDossiers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
