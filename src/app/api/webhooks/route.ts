import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { webhookLogs } from '@/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // 'success' or 'failed'
    const query = searchParams.get('query'); // search in externalId or errorMessage

    // Build conditions
    const conditions = [];
    if (status === 'success' || status === 'failed') {
      conditions.push(eq(webhookLogs.status, status));
    }
    if (query) {
      // ILIKE matching for postgresql
      conditions.push(
        sql`(${webhookLogs.externalId} ILIKE ${'%' + query + '%'} OR ${webhookLogs.errorMessage} ILIKE ${'%' + query + '%'} OR ${webhookLogs.event} ILIKE ${'%' + query + '%'})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get logs
    const logs = await db.select()
      .from(webhookLogs)
      .where(whereClause)
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db.select({ total: count() })
      .from(webhookLogs)
      .where(whereClause);

    return NextResponse.json({
      logs,
      total: countResult?.total || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
