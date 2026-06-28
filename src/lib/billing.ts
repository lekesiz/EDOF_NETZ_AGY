import { db } from '@/db/db';
import { dossiers, billingLogs, billingStepLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';

const PENNYLANE_API_BASE = 'https://app.pennylane.com/api/external/v2';
const WEDOF_API_BASE = 'https://www.wedof.fr/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BillingDossier {
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  training_title: string | null;
  start_date: string | null;
  end_date: string | null;
  amount: number;
  raw_data: Record<string, any> | null;
}

export interface BillingResult {
  external_id: string;
  success: boolean;
  invoice_number?: string;
  pennylane_invoice_id?: string;
  error?: string;
  step?: 'fetch' | 'create_invoice' | 'notify_wedof' | 'service_done' | 'gmail_notification' | 'update_supabase';
}

export interface StepLogContext {
  billingLogId: string;
  dossierExternalId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc: any, key: string) => {
    if (acc && typeof acc === 'object') {
      return acc[key];
    }
    return undefined;
  }, obj);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Logger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a billing step to billing_step_logs table.
 * Errors are silently swallowed to avoid masking the real billing error.
 */
export async function logBillingStep(
  ctx: StepLogContext,
  stepName: string,
  stepOrder: number,
  status: 'success' | 'failed' | 'skipped',
  startedAt: Date,
  inputData?: Record<string, any>,
  outputData?: Record<string, any>,
  errorMessage?: string,
  errorCode?: string
): Promise<void> {
  try {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await db.insert(billingStepLogs).values({
      billingLogId: ctx.billingLogId,
      dossierExternalId: ctx.dossierExternalId,
      stepName,
      stepOrder,
      status,
      inputData: inputData || null,
      outputData: outputData || null,
      errorMessage: errorMessage || null,
      errorCode: errorCode || null,
      startedAt,
      completedAt,
      durationMs,
    });
  } catch (e) {
    console.error('[StepLog] Failed to write step log:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wedof: Fetch Dossiers Ready to Bill
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all dossiers from Wedof with state=serviceDoneValidated and billingState=toBill.
 * Supports pagination for >100 dossiers.
 */
export async function fetchDossiersToBill(apiKey: string): Promise<Record<string, any>[]> {
  const allFolders: Record<string, any>[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('page', String(page));
    params.set('state', 'serviceDoneValidated');
    params.set('billingState', 'toBill');
    // Only process dossiers from 2026 onwards — ignore legacy backlog
    params.set('filterOnStateDate', 'serviceDoneValidatedDate');
    params.set('dateAfter', '2026-01-01');

    const url = `${WEDOF_API_BASE}/registrationFolders?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        'X-API-KEY': apiKey,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wedof fetch dossiers failed: ${res.status} - ${text}`);
    }

    const data = await res.json();
    const folders: Record<string, any>[] = Array.isArray(data) ? data : [];

    if (folders.length === 0) break;
    allFolders.push(...folders);
    if (folders.length < limit) break;
    page++;
  }

  return allFolders;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pennylane: Find or Create Customer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find an existing Pennylane customer by source_id, or create a new individual customer.
 */
async function findOrCreatePennylaneCustomer(
  dossier: BillingDossier,
  token: string
): Promise<number> {
  const rawData = dossier.raw_data || {};
  const attendee = (rawData.attendee as Record<string, any>) || {};
  const address = (attendee.address as Record<string, any>) || {};

  // Try to find existing customer by external_reference (= dossier.external_id)
  const filterParam = encodeURIComponent(JSON.stringify([{ field: 'external_reference', operator: 'eq', value: dossier.external_id }]));
  const searchUrl = `${PENNYLANE_API_BASE}/customers?filter=${filterParam}`;
  const searchRes = await fetch(searchUrl, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const customers = searchData.customers || searchData.items || [];
    if (Array.isArray(customers) && customers.length > 0) {
      const existing = customers[0] as Record<string, any>;
      if (existing.id) {
        console.log(`[Pennylane] Found existing customer id=${existing.id} for dossier ${dossier.external_id}`);
        return Number(existing.id);
      }
    }
  }

  // Create new individual customer
  const streetLine = (
    (address.fullAddress as string) ||
    [address.number, address.roadType, address.roadName].filter(Boolean).join(' ') ||
    'Non renseigné'
  );

  const customerPayload: Record<string, any> = {
    first_name: dossier.first_name || 'Inconnu',
    last_name: dossier.last_name || 'Inconnu',
    payment_conditions: '30_days',
    external_reference: dossier.external_id,
    notes: `Dossier Wedof: ${dossier.external_id}`,
    billing_address: {
      address: streetLine,
      postal_code: (address.zipCode as string) || '',
      city: (address.city as string) || '',
      country_alpha2: (address.countryCode as string) || 'FR',
    },
  };

  if (dossier.email) {
    customerPayload.emails = [dossier.email];
  }
  if (dossier.phone) {
    customerPayload.phone = dossier.phone;
  }

  const createRes = await fetch(`${PENNYLANE_API_BASE}/individual_customers`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(customerPayload),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Pennylane create customer failed: ${createRes.status} - ${text}`);
  }

  const customerData = await createRes.json();
  const customer = customerData.customer || customerData;
  if (!customer?.id) {
    throw new Error(`Pennylane create customer: no id in response — ${JSON.stringify(customerData)}`);
  }
  console.log(`[Pennylane] Created new customer id=${customer.id} for dossier ${dossier.external_id}`);
  return Number(customer.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pennylane: Create Customer Invoice
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Pennylane customer invoice for a dossier.
 */
export async function createPennylaneInvoice(
  dossier: BillingDossier,
  token: string,
  ctx?: StepLogContext
): Promise<{ invoiceNumber: string; invoiceId: string }> {
  const stepStart = new Date();

  const rawData = dossier.raw_data || {};
  const trainingActionInfo = (rawData.trainingActionInfo as Record<string, any>) || {};

  const amountToInvoice =
    (rawData.amountToInvoice as number) ||
    (trainingActionInfo.totalIncl as number) ||
    (trainingActionInfo.totalExcl as number) ||
    dossier.amount;

  const today = new Date();
  const invoiceDate = today.toISOString().split('T')[0];
  const deadlineDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  let customerId: number;
  try {
    customerId = await findOrCreatePennylaneCustomer(dossier, token);
  } catch (customerError: any) {
    const errorMessage = customerError.message || String(customerError);
    if (ctx) {
      await logBillingStep(
        ctx,
        'pennylane_customer',
        2,
        'failed',
        stepStart,
        { dossier_external_id: dossier.external_id },
        undefined,
        errorMessage,
        'CUSTOMER_ERROR'
      );
    }
    throw new Error(errorMessage);
  }

  const sessionStart = (rawData.history as Record<string, any>)?.inTrainingDate as string || '';
  const sessionEnd = (rawData.history as Record<string, any>)?.terminatedDate as string || '';
  const trainingTitle = dossier.training_title || (rawData.trainingActionInfo as Record<string, any>)?.title as string || dossier.external_id;

  const invoicePayload = {
    customer_id: customerId,
    date: invoiceDate,
    deadline: deadlineDate,
    draft: false, // Create finalized invoice directly
    currency: 'EUR',
    language: 'fr_FR',
    pdf_invoice_subject: dossier.external_id,
    pdf_invoice_free_text: '',
    invoice_lines: [
      {
        label: `Formation ${trainingTitle}`,
        unit: 'piece',
        quantity: 1,
        raw_currency_unit_price: String(amountToInvoice),
        vat_rate: 'exempt', // Formation professionnelle exonérée de TVA (Article 261-4-4° CGI)
        description: `Dossier num.${dossier.external_id} Session du ${sessionStart} au ${sessionEnd}`,
      },
    ],
  };

  const invoiceUrl = `${PENNYLANE_API_BASE}/customer_invoices`;

  const createRes = await fetch(invoiceUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(invoicePayload),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    const errorMessage = `Pennylane create invoice failed: ${createRes.status} - ${text}`;

    if (ctx) {
      await logBillingStep(
        ctx,
        'pennylane_invoice',
        3,
        'failed',
        stepStart,
        {
          dossier_external_id: dossier.external_id,
          amount: amountToInvoice,
          payload: invoicePayload,
        },
        undefined,
        errorMessage,
        String(createRes.status)
      );
    }

    throw new Error(errorMessage);
  }

  const createData = await createRes.json();
  const invoiceObj = createData.invoice || createData;
  const invoiceId = String(invoiceObj.id);
  const invoiceNumber = invoiceObj.invoice_number;

  if (!invoiceId || !invoiceNumber) {
    throw new Error(`Pennylane create invoice: missing id or invoice_number in response — ${JSON.stringify(createData).slice(0, 200)}`);
  }

  const result = {
    invoiceNumber,
    invoiceId,
  };

  if (ctx) {
    await logBillingStep(
      ctx,
      'pennylane_invoice',
      3,
      'success',
      stepStart,
      {
        dossier_external_id: dossier.external_id,
        amount: amountToInvoice,
      },
      {
        invoice_number: result.invoiceNumber,
        invoice_id: result.invoiceId,
        customer_id: invoiceObj.customer?.id,
      }
    );
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wedof: Declare Service Done
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify Wedof that service has been rendered.
 */
export async function notifyWedofServiceDone(
  externalId: string,
  apiKey: string,
  ctx?: StepLogContext
): Promise<void> {
  const stepStart = new Date();
  const url = `${WEDOF_API_BASE}/registrationFolders/${externalId}/serviceDone`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    const isAlreadyServiceDone =
      res.status === 400 &&
      (text.includes('serviceDoneValidated') || text.includes('service_done_validated'));

    if (isAlreadyServiceDone) {
      if (ctx) {
        await logBillingStep(
          ctx,
          'wedof_notify',
          5,
          'skipped',
          stepStart,
          { external_id: externalId },
          { reason: 'already_service_done_validated', wedof_response: text }
        );
      }
      return;
    }

    const errorMessage = `Wedof serviceDone failed: ${res.status} - ${text}`;

    if (ctx) {
      await logBillingStep(
        ctx,
        'wedof_notify',
        5,
        'failed',
        stepStart,
        { external_id: externalId },
        undefined,
        errorMessage,
        String(res.status)
      );
    }

    throw new Error(errorMessage);
  }

  if (ctx) {
    let responseData: Record<string, any> = {};
    try {
      responseData = await res.json();
    } catch {
      // response may be empty
    }

    await logBillingStep(
      ctx,
      'wedof_notify',
      5,
      'success',
      stepStart,
      { external_id: externalId },
      {
        wedof_state: responseData?.state || 'serviceDoneValidated',
        response: responseData,
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gmail: Send Billing Notification Email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a billing notification email via SMTP (Gmail).
 */
export async function sendBillingNotificationEmail(
  dossier: BillingDossier,
  invoiceNumber: string,
  ctx?: StepLogContext
): Promise<void> {
  const stepStart = new Date();

  const notificationEmail = process.env.BILLING_NOTIFICATION_EMAIL || 'mikail@netzinformatique.fr';
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    if (ctx) {
      await logBillingStep(
        ctx,
        'supabase_update', // step 6 (update is after notification, but SMTP skip doesn't fail billing)
        6,
        'skipped',
        stepStart,
        { reason: 'GMAIL_USER or GMAIL_APP_PASSWORD not configured' },
        undefined
      );
    }
    console.warn('[Billing] Gmail notification skipped: credentials not configured');
    return;
  }

  const subject = `✅ Facture créée - ${dossier.first_name || ''} ${dossier.last_name || ''} (${dossier.external_id})`;
  const body = [
    `Nouvelle facture créée avec succès.`,
    ``,
    `📋 Dossier: ${dossier.external_id}`,
    `👤 Apprenant: ${dossier.first_name || ''} ${dossier.last_name || ''}`,
    `📧 Email: ${dossier.email || 'N/A'}`,
    `🎓 Formation: ${dossier.training_title || 'N/A'}`,
    `📅 Session: ${dossier.start_date || 'N/A'} → ${dossier.end_date || 'N/A'}`,
    `💶 Montant: ${dossier.amount.toFixed(2)} €`,
    `🧾 N° Facture: ${invoiceNumber}`,
    ``,
    `Voir dans Pennylane: https://app.pennylane.com`,
    `Voir dans Wedof: https://www.wedof.fr`,
  ].join('\n');

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: gmailUser,
      to: notificationEmail,
      subject,
      text: body,
    });

    if (ctx) {
      await logBillingStep(
        ctx,
        'supabase_update',
        6,
        'success',
        stepStart,
        { to: notificationEmail, subject },
        { sent: true }
      );
    }
  } catch (e: any) {
    const errorMessage = e.message || String(e);
    if (ctx) {
      await logBillingStep(
        ctx,
        'supabase_update',
        6,
        'failed',
        stepStart,
        { to: notificationEmail, subject },
        undefined,
        errorMessage
      );
    }
    console.error('[Billing] Gmail notification failed:', errorMessage);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wedof: Mark Dossier as Billed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify Wedof that a dossier has been billed.
 */
export async function notifyWedofBilling(
  externalId: string,
  billNumber: string,
  apiKey: string,
  ctx?: StepLogContext
): Promise<void> {
  const stepStart = new Date();
  const url = `${WEDOF_API_BASE}/registrationFolders/${externalId}/billing`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ billNumber }),
  });

  if (!res.ok) {
    const text = await res.text();
    const errorMessage = `Wedof billing notification failed: ${res.status} - ${text}`;

    if (ctx) {
      await logBillingStep(
        ctx,
        'wedof_notify',
        4,
        'failed',
        stepStart,
        { external_id: externalId, bill_number: billNumber },
        undefined,
        errorMessage,
        String(res.status)
      );
    }

    throw new Error(errorMessage);
  }

  if (ctx) {
    let responseData: Record<string, any> = {};
    try {
      responseData = await res.json();
    } catch {
      // response may be empty
    }

    await logBillingStep(
      ctx,
      'wedof_notify',
      4,
      'success',
      stepStart,
      { external_id: externalId, bill_number: billNumber },
      {
        wedof_billing_state: responseData?.billingState || 'billed',
        response: responseData,
      }
    );
  }
}
