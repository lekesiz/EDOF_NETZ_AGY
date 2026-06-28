const WEDOF_API_BASE = 'https://www.wedof.fr/api';
const WEDOF_API_KEY = process.env.WEDOF_API_KEY!;
const PAGE_SIZE = 50;

/**
 * Fetches all registration folders from WEDOF API with pagination.
 * WEDOF uses `limit` and `page` (1-based) parameters.
 */
export async function fetchAllRegistrationFolders(apiKeyInput?: string): Promise<Record<string, any>[]> {
  const apiKey = apiKeyInput || WEDOF_API_KEY;
  if (!apiKey) {
    throw new Error('WEDOF_API_KEY is not defined');
  }

  const allFolders: Record<string, any>[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${WEDOF_API_BASE}/registrationFolders?limit=${PAGE_SIZE}&page=${page}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`WEDOF API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // WEDOF returns an array directly
    const folders: Record<string, any>[] = Array.isArray(data) ? data : [];
    
    if (folders.length === 0) {
      hasMore = false;
    } else {
      allFolders.push(...folders);
      if (folders.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allFolders;
}

/**
 * Extract a nested value safely.
 */
function get(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc: any, key: string) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

/**
 * Extract date string from ISO datetime.
 */
function extractDate(value: any): string | null {
  if (!value || typeof value !== 'string') return null;
  return value.split('T')[0] || null;
}

/**
 * Maps a WEDOF folder to our database format.
 */
export function mapWedofToDossier(folder: Record<string, any>) {
  // Amount: trainingActionInfo.totalIncl is the TTC amount
  const amount = get(folder, 'trainingActionInfo.totalIncl') 
    || get(folder, 'trainingActionInfo.totalExcl')
    || get(folder, 'trainingActionInfo.vat')
    || 0;

  // Payment date from milestones
  const paidDate = get(folder, 'milestones.paidDate')
    || get(folder, 'paymentDate')
    || null;

  // Dates
  const startDate = get(folder, 'trainingActionInfo.sessionStartDate');
  const endDate = get(folder, 'trainingActionInfo.sessionEndDate');
  const dob = get(folder, 'attendee.dateOfBirth');

  return {
    externalId: String(get(folder, 'externalId') || ''),
    firstName: String(get(folder, 'attendee.firstName') || '') || null,
    lastName: String(get(folder, 'attendee.lastName') || '') || null,
    dob: extractDate(dob),
    email: String(get(folder, 'attendee.email') || '') || null,
    phone: String(get(folder, 'attendee.phoneNumber') || '') || null,
    trainingTitle: String(get(folder, 'trainingActionInfo.title') || '') || null,
    startDate: extractDate(startDate),
    endDate: extractDate(endDate),
    wedofStatus: String(get(folder, 'state') || '') || 'unknown',
    amount: String(Number(amount) || 0),
    wedofPaidDate: extractDate(paidDate),
    rawData: folder,
    updatedAt: new Date(),
  };
}
