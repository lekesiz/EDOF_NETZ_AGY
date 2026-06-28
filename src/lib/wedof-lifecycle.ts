/**
 * wedof-lifecycle.ts — Automatisation du cycle de vie des dossiers Wedof (Drizzle version).
 */

import { db } from '@/db/db';
import { dossiers } from '@/db/schema';
import { eq, and, isNotNull, lte } from 'drizzle-orm';

const WEDOF_API_BASE = 'https://www.wedof.fr/api';

export interface LifecycleResult {
  externalId: string;
  attendeeName: string;
  status: 'success' | 'skipped' | 'failed';
  detail?: string;
}

interface FetchOptions {
  state: string;
  filterOnStateDate?: string;
  period?: string;
  dateAfter?: string;
  dateBefore?: string;
}

function authHeaders(apiKey: string): HeadersInit {
  return { accept: 'application/json', 'X-API-KEY': apiKey };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number; label?: string } = {}
): Promise<Response> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 20000;
  const label = opts.label ?? url;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status >= 500 && attempt < retries) {
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const reason = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
        console.warn(
          `[wedof] fetch échec (tentative ${attempt}/${retries}) ${label}: ${reason} — nouvel essai dans ${wait}ms`
        );
        await sleep(wait);
        continue;
      }
    }
  }
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`Wedof fetch failed après ${retries} tentatives (${label}): ${reason}`);
}

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function attendeeName(folder: Record<string, unknown> | DbCandidate): string {
  if ('first_name' in folder) {
    const candidate = folder as DbCandidate;
    return `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || candidate.external_id;
  }
  const first = get(folder as Record<string, unknown>, 'attendee.firstName') || '';
  const last = get(folder as Record<string, unknown>, 'attendee.lastName') || '';
  return `${first} ${last}`.trim() || String(get(folder as Record<string, unknown>, 'externalId') || 'inconnu');
}

export async function fetchDossiersByState(
  apiKey: string,
  opts: FetchOptions
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('page', String(page));
    params.set('state', opts.state);
    if (opts.filterOnStateDate) params.set('filterOnStateDate', opts.filterOnStateDate);
    if (opts.period) params.set('period', opts.period);
    if (opts.dateAfter) params.set('dateAfter', opts.dateAfter);
    if (opts.dateBefore) params.set('dateBefore', opts.dateBefore);

    const url = `${WEDOF_API_BASE}/registrationFolders?${params.toString()}`;
    const res = await fetchWithRetry(
      url,
      { headers: authHeaders(apiKey) },
      { label: `list ${opts.state} p${page}` }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wedof list (${opts.state}) failed: ${res.status} - ${text}`);
    }
    const data = await res.json();
    const folders: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    if (folders.length === 0) break;
    all.push(...folders);
    if (folders.length < limit) break;
    page++;
  }
  return all;
}

function isAlreadyInState(status: number, text: string, ...markers: string[]): boolean {
  if (status !== 400 && status !== 409) return false;
  const lower = text.toLowerCase();
  return markers.some((m) => lower.includes(m.toLowerCase()));
}

async function postTransition(
  apiKey: string,
  externalId: string,
  action: string,
  body: Record<string, unknown>,
  alreadyMarkers: string[]
): Promise<'success' | 'skipped'> {
  const url = `${WEDOF_API_BASE}/registrationFolders/${externalId}/${action}`;
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { ...authHeaders(apiKey), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    { label: `${action} ${externalId}` }
  );
  if (res.ok) return 'success';

  const text = await res.text();
  if (isAlreadyInState(res.status, text, ...alreadyMarkers)) return 'skipped';
  throw new Error(`Wedof ${action} (${externalId}) failed: ${res.status} - ${text}`);
}

export async function declareInTraining(
  apiKey: string,
  externalId: string,
  startDate?: string | null
): Promise<'success' | 'skipped'> {
  const body: Record<string, unknown> = {};
  if (startDate) body.startDate = startDate;
  return postTransition(apiKey, externalId, 'inTraining', body, [
    'inTraining',
    'in_training',
    'en formation',
  ]);
}

export async function declareTerminated(
  apiKey: string,
  externalId: string,
  endDate?: string | null
): Promise<'success' | 'skipped'> {
  const body: Record<string, unknown> = { code: 8, absenceDuration: 0 };
  if (endDate) body.endDate = endDate;
  return postTransition(apiKey, externalId, 'terminate', body, [
    'terminated',
    'serviceDone',
    'service_done',
  ]);
}

export async function declareServiceDone(
  apiKey: string,
  externalId: string
): Promise<'success' | 'skipped'> {
  return postTransition(apiKey, externalId, 'serviceDone', { code: 8, absenceDuration: 0 }, [
    'serviceDoneValidated',
    'service_done_validated',
    'serviceDone',
  ]);
}

export interface DbCandidate {
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  start_date: string | null;
  end_date: string | null;
  wedof_status: string | null;
}

export type DbStep = 'intraining' | 'terminate' | 'servicedone';

export async function selectCandidatesFromDb(
  step: DbStep,
  today: string,
  limit = 150
): Promise<DbCandidate[]> {
  let query;

  if (step === 'intraining') {
    query = db.select({
      external_id: dossiers.externalId,
      first_name: dossiers.firstName,
      last_name: dossiers.lastName,
      start_date: dossiers.startDate,
      end_date: dossiers.endDate,
      wedof_status: dossiers.wedofStatus,
    })
    .from(dossiers)
    .where(
      and(
        eq(dossiers.wedofStatus, 'accepted'),
        isNotNull(dossiers.startDate),
        lte(dossiers.startDate, today)
      )
    )
    .limit(limit);
  } else if (step === 'terminate') {
    query = db.select({
      external_id: dossiers.externalId,
      first_name: dossiers.firstName,
      last_name: dossiers.lastName,
      start_date: dossiers.startDate,
      end_date: dossiers.endDate,
      wedof_status: dossiers.wedofStatus,
    })
    .from(dossiers)
    .where(
      and(
        eq(dossiers.wedofStatus, 'inTraining'),
        isNotNull(dossiers.endDate),
        lte(dossiers.endDate, today)
      )
    )
    .limit(limit);
  } else {
    query = db.select({
      external_id: dossiers.externalId,
      first_name: dossiers.firstName,
      last_name: dossiers.lastName,
      start_date: dossiers.startDate,
      end_date: dossiers.endDate,
      wedof_status: dossiers.wedofStatus,
    })
    .from(dossiers)
    .where(eq(dossiers.wedofStatus, 'terminated'))
    .limit(limit);
  }

  const data = await query;
  return data;
}
