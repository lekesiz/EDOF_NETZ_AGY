import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { dossiers } from '@/db/schema';
import { categorizeDossier, getDueDate } from '@/lib/financial-engine';
import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { format, parseISO } from 'date-fns';
import { or, gte, lte, and, desc } from 'drizzle-orm';
import type { Dossier } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Fetch dossiers matching the year
    const dbDossiers = await db.select()
      .from(dossiers)
      .where(
        and(
          or(
            gte(dossiers.endDate, yearStart),
            gte(dossiers.startDate, yearStart)
          ),
          lte(dossiers.startDate, yearEnd)
        )
      )
      .orderBy(desc(dossiers.endDate));

    const typedDossiers: Dossier[] = dbDossiers.map(d => ({
      id: d.id,
      external_id: d.externalId,
      first_name: d.firstName,
      last_name: d.lastName,
      dob: d.dob,
      email: d.email,
      phone: d.phone,
      training_title: d.trainingTitle,
      start_date: d.startDate,
      end_date: d.endDate,
      wedof_status: d.wedofStatus,
      amount: parseFloat(d.amount),
      wedof_paid_date: d.wedofPaidDate,
      pennylane_paid_date: d.pennylanePaidDate,
      pennylane_invoice_number: d.pennylaneInvoiceNumber,
      is_reconciled: d.isReconciled,
      raw_data: d.rawData as Record<string, unknown> | null,
      created_at: d.createdAt.toISOString(),
      updated_at: d.updatedAt.toISOString(),
    }));

    // 2. Build CSV
    const headers = [
      'N° Dossier',
      'Nom',
      'Prénom',
      'E-mail',
      'Formation',
      'Date début',
      'Date fin',
      'Statut WEDOF',
      'Montant',
      'Date échéance',
      'Catégorie',
      'Rapproché',
      'Date paiement Pennylane',
    ];

    const rows = typedDossiers.map((d) => {
      const dueDate = getDueDate(d.end_date);
      const category = categorizeDossier(d);
      return [
        d.external_id,
        d.last_name || '',
        d.first_name || '',
        d.email || '',
        d.training_title || '',
        d.start_date || '',
        d.end_date || '',
        d.wedof_status || '',
        d.amount.toString(),
        dueDate ? format(dueDate, 'yyyy-MM-dd') : '',
        category,
        d.is_reconciled ? 'Oui' : 'Non',
        d.pennylane_paid_date || '',
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    // Add UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';

    return new NextResponse(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="edof_export_${year}.csv"`,
      },
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Erreur inconnue';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
