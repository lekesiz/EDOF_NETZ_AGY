import type { NextRequest } from 'next/server';
import { db } from '@/db/db';
import { syncLogs } from '@/db/schema';

export type TriggerSource = 'cron' | 'manual';

/**
 * Detects if the request comes from Vercel Cron scheduler or manual invocation
 */
export function detectSource(request: NextRequest | Request): TriggerSource {
  try {
    const h = request.headers;
    if (h instanceof Headers) {
      if (h.get('x-vercel-cron')) return 'cron';
      if (h.get('x-vercel-scheduled')) return 'cron';
    } else {
      const headersObj = h as Record<string, string>;
      if (headersObj['x-vercel-cron']) return 'cron';
      if (headersObj['x-vercel-scheduled']) return 'cron';
    }
  } catch {
    /* ignore */
  }
  return 'manual';
}

export interface ActivityLogInput {
  syncType: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  source?: TriggerSource | string;
  recordsProcessed?: number | null;
  recordsCreated?: number | null;
  recordsUpdated?: number | null;
  durationMs?: number | null;
  detail?: string | null;
}

/**
 * Log action results to sync_logs
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    await db.insert(syncLogs).values({
      syncType: input.syncType,
      status: input.status,
      recordsProcessed: input.recordsProcessed ?? 0,
      recordsCreated: input.recordsCreated ?? 0,
      recordsUpdated: input.recordsUpdated ?? 0,
      durationMs: input.durationMs ?? 0,
      errorMessage: input.detail ?? null,
      triggeredBy: input.source ?? 'cron',
    });
  } catch (e) {
    console.error('[activity-log] failed to write sync_logs:', e);
  }
}
