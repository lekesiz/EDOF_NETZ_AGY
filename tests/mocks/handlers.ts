import { http, HttpResponse } from 'msw';

export const handlers = [
  // ── WEDOF API MOCKS ────────────────────────────────────────────────────────
  
  // 1. Fetch registration folders
  http.get('https://www.wedof.fr/api/registrationFolders', ({ request }) => {
    const url = new URL(request.url);
    const billingState = url.searchParams.get('billingState');
    const state = url.searchParams.get('state');

    // If fetching for billing automation
    if (billingState === 'toBill' && state === 'serviceDoneValidated') {
      return HttpResponse.json([
        {
          externalId: 'EDOF-MOCK-9999',
          attendee: {
            firstName: 'Alexandre',
            lastName: 'DUPONT',
            email: 'alex.dupont@testmail.com',
            phoneNumber: '0699001122',
            dateOfBirth: '1989-10-15',
            address: {
              fullAddress: '15 Rue de la Paix, 75002 Paris',
              zipCode: '75002',
              city: 'Paris',
              countryCode: 'FR',
            },
          },
          trainingActionInfo: {
            title: 'Formation UI/UX Designer CPF',
            sessionStartDate: '2026-03-01T08:00:00Z',
            sessionEndDate: '2026-04-10T17:00:00Z',
            totalIncl: 1800.00,
          },
          state: 'serviceDoneValidated',
          billingState: 'toBill',
        },
      ]);
    }

    // Default listing
    return HttpResponse.json([]);
  }),

  // 2. Notify Wedof Billed
  http.post('https://www.wedof.fr/api/registrationFolders/:externalId/billing', async ({ params, request }) => {
    const { externalId } = params;
    const body = (await request.json()) as any;
    return HttpResponse.json({
      externalId,
      billingState: 'billed',
      billNumber: body.billNumber,
      updatedAt: new Date().toISOString(),
    });
  }),

  // 3. Declare Wedof Service Done
  http.post('https://www.wedof.fr/api/registrationFolders/:externalId/serviceDone', ({ params }) => {
    const { externalId } = params;
    return HttpResponse.json({
      externalId,
      state: 'serviceDoneValidated',
      updatedAt: new Date().toISOString(),
    });
  }),

  // ── PENNYLANE API MOCKS ────────────────────────────────────────────────────

  // 1. Search customers
  http.get('https://app.pennylane.com/api/external/v2/customers', () => {
    // Return empty list so a new customer is created in E2E/integration tests
    return HttpResponse.json({
      customers: [],
    });
  }),

  // 2. Create customer
  http.post('https://app.pennylane.com/api/external/v2/individual_customers', async () => {
    return HttpResponse.json({
      customer: {
        id: 777123,
        first_name: 'Alexandre',
        last_name: 'DUPONT',
      },
    });
  }),

  // 3. Create customer invoice
  http.post('https://app.pennylane.com/api/external/v2/customer_invoices', async () => {
    return HttpResponse.json({
      invoice: {
        id: '999888',
        invoice_number: 'NETZ-F-2026-9999',
        customer: { id: 777123 },
      },
    });
  }),

  // 4. Fetch paid invoices (Reconciliation)
  http.get('https://app.pennylane.com/api/external/v2/customer_invoices', () => {
    return HttpResponse.json({
      items: [
        {
          invoice_number: 'NETZ-F-2026-9999',
          amount: 1800.00,
          date: '2026-04-18',
          paid: true,
          label: 'Facture Alexandre DUPONT - NETZ-F-2026-9999',
        },
      ],
      has_more: false,
    });
  }),
];
