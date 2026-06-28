import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { emailLogs } from '@/db/schema';
import { eq, and, gte, lte, ilike, desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search')?.trim() || '';

    const offset = (page - 1) * limit;

    // 2. Build where conditions
    const conditions = [];

    if (type) {
      conditions.push(eq(emailLogs.emailType, type));
    }
    if (from) {
      conditions.push(gte(emailLogs.sentAt, new Date(`${from}T00:00:00`)));
    }
    if (to) {
      conditions.push(lte(emailLogs.sentAt, new Date(`${to}T23:59:59`)));
    }
    if (search) {
      conditions.push(ilike(emailLogs.email, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 3. Count total logs
    const [countResult] = await db.select({ total: count() }).from(emailLogs).where(whereClause);
    const total = countResult?.total || 0;

    // 4. Retrieve paginated results
    const results = await db.select()
      .from(emailLogs)
      .where(whereClause)
      .orderBy(desc(emailLogs.sentAt))
      .limit(limit)
      .offset(offset);

    // Map database results
    const formattedLogs = results.map(l => ({
      id: l.id,
      dossier_id: l.dossierId,
      email: l.email,
      email_type: l.emailType,
      resend_id: l.resendId,
      sent_at: l.sentAt.toISOString(),
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
