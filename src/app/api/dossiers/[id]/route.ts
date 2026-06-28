import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers, pennylaneInvoices, emailLogs, settings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Session verification
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'ID du dossier requis' }, { status: 400 });
    }

    // 2. Fetch dossier by UUID id
    let dossier = null;
    
    // Check if ID is UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) {
      const [d] = await db.select().from(dossiers).where(eq(dossiers.id, id));
      dossier = d;
    }

    // If not found by UUID, try searching by external_id
    if (!dossier) {
      const [d] = await db.select().from(dossiers).where(eq(dossiers.externalId, id));
      dossier = d;
    }

    if (!dossier) {
      return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });
    }

    return await buildResponse(dossier);
  } catch (error: any) {
    const errorMessage = error.message || 'Erreur inconnue';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function buildResponse(dossier: any) {
  // 1. Get associated Pennylane invoice
  let invoice = null;
  if (dossier.pennylaneInvoiceNumber) {
    const [invoiceData] = await db.select()
      .from(pennylaneInvoices)
      .where(eq(pennylaneInvoices.invoiceNumber, dossier.pennylaneInvoiceNumber));
    invoice = invoiceData || null;
  }

  // 2. Get sent email history
  let emails: any[] = [];
  if (dossier.email) {
    const emailData = await db.select()
      .from(emailLogs)
      .where(eq(emailLogs.email, dossier.email))
      .orderBy(desc(emailLogs.sentAt));
    
    emails = emailData.map(e => ({
      id: e.id,
      dossier_id: e.dossierId,
      email: e.email,
      email_type: e.emailType,
      resend_id: e.resendId,
      sent_at: e.sentAt.toISOString(),
    }));
  }

  // 3. Get due date settings
  const [vadeGunSetting] = await db.select().from(settings).where(eq(settings.key, 'vade_gun'));
  const vadeGun = vadeGunSetting?.value ? Number(vadeGunSetting.value) : 37;

  // 4. Calculate due date and status category
  const endDate = dossier.endDate ? new Date(dossier.endDate) : null;
  const vadeTarihi = endDate
    ? new Date(endDate.getTime() + vadeGun * 24 * 60 * 60 * 1000)
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const CANCEL_KEYWORDS = ['cancel', 'refus', 'reject', 'annul', 'abandon'];
  const status = (dossier.wedofStatus || '').toLowerCase();

  let categorie: 'encaisse' | 'en_attente' | 'annule' = 'en_attente';
  if (CANCEL_KEYWORDS.some(kw => status.includes(kw))) {
    categorie = 'annule';
  } else if (vadeTarihi && vadeTarihi <= today) {
    categorie = 'encaisse';
  }

  // 5. Extract Wedof details from raw_data
  const rawData = dossier.rawData as Record<string, any> | null;
  let wedofDetails = null;
  if (rawData) {
    wedofDetails = {
      type: rawData.type || null,
      state: rawData.state || null,
      completionRate: rawData.completionRate || null,
      certificationState: rawData.certificationState || null,
      billingState: rawData.billingState || null,
      organism: rawData.organism || null,
      createdAt: rawData.createdAt || null,
      updatedAt: rawData.updatedAt || null,
      notes: rawData.notes || null,
      tags: rawData.tags || [],
    };
  }

  // 6. Build response
  return NextResponse.json({
    dossier: {
      id: dossier.id,
      external_id: dossier.externalId,
      first_name: dossier.firstName,
      last_name: dossier.lastName,
      email: dossier.email,
      phone: dossier.phone,
      dob: dossier.dob,
      training_title: dossier.trainingTitle,
      start_date: dossier.startDate,
      end_date: dossier.endDate,
      wedof_status: dossier.wedofStatus,
      amount: parseFloat(dossier.amount),
      is_reconciled: dossier.isReconciled,
      pennylane_invoice_number: dossier.pennylaneInvoiceNumber,
      pennylane_paid_date: dossier.pennylanePaidDate,
      wedof_paid_date: dossier.wedofPaidDate,
      vade_tarihi: vadeTarihi ? vadeTarihi.toISOString().split('T')[0] : null,
      categorie,
      vade_gun: vadeGun,
    },
    wedofDetails,
    invoice,
    emails,
  });
}
