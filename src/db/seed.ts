import { db } from './db';
import { dossiers, pennylaneInvoices, settings } from './schema';

async function main() {
  console.log('Seeding settings...');

  // Seed default settings
  await db.insert(settings).values([
    { key: 'target_2025', value: '1000000', updatedAt: new Date() },
    { key: 'target_2026', value: '2000000', updatedAt: new Date() },
    { key: 'target_2027', value: '4000000', updatedAt: new Date() },
    { key: 'vade_gun', value: '37', updatedAt: new Date() },
  ]).onConflictDoNothing();

  console.log('Seeding dossiers...');

  // 2026 Date helpers
  const d2026 = (monthStr: string, dayStr: string) => `2026-${monthStr}-${dayStr}`;

  // Seed dossiers
  await db.insert(dossiers).values([
    {
      externalId: 'EDOF-2026-0001',
      firstName: 'Ahmet',
      lastName: 'YILMAZ',
      dob: '1990-05-12',
      email: 'ahmet.yilmaz@mail.com',
      phone: '0612345678',
      trainingTitle: 'Titre Professionnel Développeur Web et Web Mobile',
      startDate: d2026('01', '05'),
      endDate: d2026('02', '10'),
      wedofStatus: 'serviceDoneValidated',
      amount: '1500.00',
      isReconciled: false,
      rawData: {
        attendee: { firstName: 'Ahmet', lastName: 'YILMAZ', email: 'ahmet.yilmaz@mail.com' },
        trainingActionInfo: { title: 'Titre Professionnel Développeur Web et Web Mobile', sessionStartDate: d2026('01', '05'), sessionEndDate: d2026('02', '10') },
        amountToInvoice: 1500.00,
        state: 'serviceDoneValidated',
        billingState: 'toBill',
      },
    },
    {
      externalId: 'EDOF-2026-0002',
      firstName: 'Elise',
      lastName: 'HERAULT',
      dob: '1993-09-24',
      email: 'elise.herault@outlook.com',
      phone: '0678901234',
      trainingTitle: 'Concevoir et développer des applications web',
      startDate: d2026('02', '15'),
      endDate: d2026('03', '20'),
      wedofStatus: 'serviceDoneDeclared',
      amount: '2000.00',
      isReconciled: false,
      rawData: {
        attendee: { firstName: 'Elise', lastName: 'HERAULT', email: 'elise.herault@outlook.com' },
        trainingActionInfo: { title: 'Concevoir et développer des applications web', sessionStartDate: d2026('02', '15'), sessionEndDate: d2026('03', '20') },
        amountToInvoice: 2000.00,
        state: 'serviceDoneDeclared',
        billingState: 'toBill',
      },
    },
    {
      externalId: 'EDOF-2026-0003',
      firstName: 'Jean-Pierre',
      lastName: 'DE JESUS',
      dob: '1985-11-02',
      email: 'jp.dejesus@gmail.com',
      phone: '0687654321',
      trainingTitle: 'Titre Professionnel Développeur Web et Web Mobile',
      startDate: d2026('01', '10'),
      endDate: d2026('02', '15'),
      wedofStatus: 'serviceDoneValidated',
      amount: '1500.00',
      isReconciled: false,
      rawData: {
        attendee: { firstName: 'Jean-Pierre', lastName: 'DE JESUS', email: 'jp.dejesus@gmail.com' },
        trainingActionInfo: { title: 'Titre Professionnel Développeur Web et Web Mobile', sessionStartDate: d2026('01', '10'), sessionEndDate: d2026('02', '15') },
        amountToInvoice: 1500.00,
        state: 'serviceDoneValidated',
        billingState: 'toBill',
      },
    },
    {
      externalId: 'EDOF-2026-0004',
      firstName: 'Marie',
      lastName: 'CHRISTINE',
      dob: '1995-07-15',
      email: 'm.christine@yahoo.fr',
      phone: '0622334455',
      trainingTitle: 'Anglais Professionnel - CPF',
      startDate: d2026('03', '01'),
      endDate: d2026('04', '05'),
      wedofStatus: 'instruction',
      amount: '800.00',
      isReconciled: false,
      rawData: {
        attendee: { firstName: 'Marie', lastName: 'CHRISTINE', email: 'm.christine@yahoo.fr' },
        trainingActionInfo: { title: 'Anglais Professionnel - CPF', sessionStartDate: d2026('03', '01'), sessionEndDate: d2026('04', '05') },
        amountToInvoice: 800.00,
        state: 'instruction',
        billingState: 'none',
      },
    },
    {
      externalId: 'EDOF-2026-0005',
      firstName: 'François',
      lastName: 'GARCON',
      dob: '1988-12-30',
      email: 'f.garcon@mail.com',
      phone: '0655667788',
      trainingTitle: 'Concevoir et développer des applications web',
      startDate: d2026('02', '01'),
      endDate: d2026('03', '05'),
      wedofStatus: 'refusedByOrganism',
      amount: '2000.00',
      isReconciled: false,
      rawData: {
        attendee: { firstName: 'François', lastName: 'GARCON', email: 'f.garcon@mail.com' },
        trainingActionInfo: { title: 'Concevoir et développer des applications web', sessionStartDate: d2026('02', '01'), sessionEndDate: d2026('03', '05') },
        amountToInvoice: 2000.00,
        state: 'refusedByOrganism',
        billingState: 'none',
      },
    },
  ]).onConflictDoNothing();

  console.log('Seeding Pennylane invoices...');

  // Seed invoices
  await db.insert(pennylaneInvoices).values([
    {
      invoiceNumber: 'NETZ-F-2026-0001',
      amount: '1500.00',
      paidDate: d2026('03', '18'),
      isPaid: true,
      rawData: {
        invoice_number: 'NETZ-F-2026-0001',
        amount: 1500.00,
        date: d2026('03', '18'),
        paid: true,
        label: 'Facture Ahmet YILMAZ - NETZ-F-2026-0001',
      },
    },
    {
      invoiceNumber: 'NETZ-F-2026-0002',
      amount: '2000.00',
      paidDate: null,
      isPaid: false,
      rawData: {
        invoice_number: 'NETZ-F-2026-0002',
        amount: 2000.00,
        date: null,
        paid: false,
        label: 'Facture Elise HERAULT - NETZ-F-2026-0002',
      },
    },
    {
      invoiceNumber: 'NETZ-F-2026-0003',
      amount: '1500.00',
      paidDate: d2026('03', '25'),
      isPaid: true,
      rawData: {
        invoice_number: 'NETZ-F-2026-0003',
        amount: 1500.00,
        date: d2026('03', '25'),
        paid: true,
        label: 'Facture Jean-Pierre DE JESUS - NETZ-F-2026-0003',
      },
    },
  ]).onConflictDoNothing();

  console.log('Seeding finished successfully!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
