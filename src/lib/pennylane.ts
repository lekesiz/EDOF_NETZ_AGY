const PENNYLANE_API_BASE = 'https://app.pennylane.com/api/external/v2';
const PENNYLANE_TOKEN = process.env.PENNYLANE_API_TOKEN!;

interface PennylaneListResponse<T> {
  items: T[];
  has_more?: boolean;
  next_cursor?: string;
}

async function pennylaneGet<T>(
  endpoint: string,
  params: Record<string, string> = {},
  tokenInput?: string
): Promise<PennylaneListResponse<T>> {
  const token = tokenInput || PENNYLANE_TOKEN;
  if (!token) {
    throw new Error('PENNYLANE_API_TOKEN is not defined');
  }

  const searchParams = new URLSearchParams({
    use_2026_api_changes: 'true',
    ...params,
  });

  const url = `${PENNYLANE_API_BASE}/${endpoint}?${searchParams}`;
  
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pennylane API error: ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * Fetches all customer invoices from Pennylane with cursor-based pagination.
 */
export async function fetchAllCustomerInvoices(filter?: string, tokenInput?: string): Promise<any[]> {
  const allInvoices: any[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      limit: '100',
      sort: '-id',
    };
    if (cursor) params.cursor = cursor;
    if (filter) params.filter = filter;

    const response = await pennylaneGet<any>('customer_invoices', params, tokenInput);
    allInvoices.push(...response.items);

    if (response.has_more && response.next_cursor) {
      cursor = response.next_cursor;
      // Throttling: sleep 250ms between pages to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 250));
    } else {
      hasMore = false;
    }
  }

  return allInvoices;
}

/**
 * Fetches all transactions from Pennylane with cursor-based pagination.
 */
export async function fetchAllTransactions(filter?: string, tokenInput?: string): Promise<any[]> {
  const allTransactions: any[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      limit: '100',
      sort: '-id',
    };
    if (cursor) params.cursor = cursor;
    if (filter) params.filter = filter;

    const response = await pennylaneGet<any>('transactions', params, tokenInput);
    allTransactions.push(...response.items);

    if (response.has_more && response.next_cursor) {
      cursor = response.next_cursor;
      // Throttling: sleep 250ms between pages to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 250));
    } else {
      hasMore = false;
    }
  }

  return allTransactions;
}

/**
 * Fetches recent paid invoices from Pennylane for reconciliation.
 */
export async function fetchPaidInvoices(tokenInput?: string): Promise<any[]> {
  return fetchAllCustomerInvoices(undefined, tokenInput);
}
