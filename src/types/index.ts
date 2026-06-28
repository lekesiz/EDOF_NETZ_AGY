export interface Dossier {
  id: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  email: string | null;
  phone: string | null;
  training_title: string | null;
  start_date: string | null;
  end_date: string | null;
  wedof_status: string | null;
  amount: number;
  wedof_paid_date: string | null;
  pennylane_paid_date: string | null;
  pennylane_invoice_number: string | null;
  is_reconciled: boolean;
  raw_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  dossier_id: string;
  email: string;
  email_type: 'bday' | 'survey1' | 'survey6';
  subject: string | null;
  sent_at: string;
}

export interface SyncLog {
  id: string;
  sync_type: 'wedof' | 'pennylane';
  status: 'success' | 'failed';
  records_processed: number;
  records_created: number;
  records_updated: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface DashboardStats {
  totalTarget: number;
  targetAmount: number;
  kasa: number;
  overdue: number;
  invoicedPending: number;
  uninvoiced: number;
  kayip: number;
  previousYearTotal: number;
  totalDossiers: number;
  reconciledCount: number;
}

export interface MonthlyData {
  month: string;
  kasa: number;
  alacak: number;
  kayip: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  monthlyData: MonthlyData[];
  lastSync: {
    wedof: string | null;
    pennylane: string | null;
  };
}

// WEDOF API types
export interface WedofRegistrationFolder {
  externalId: string;
  state: string;
  type: string;
  attendee: {
    lastName: string;
    firstName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
  };
  trainingActionInfo: {
    title: string;
    sessionStartDate: string;
    sessionEndDate: string;
  };
  amountTtc?: number;
  totalIncl?: number;
  amountHtNet?: number;
  billingInfo?: {
    price?: number;
    priceTTC?: number;
  };
  history?: {
    paidDate?: string;
    paymentDate?: string;
  };
  paymentDate?: string;
  [key: string]: unknown;
}

// Pennylane API types
export interface PennylaneTransaction {
  id: number;
  label: string;
  date: string;
  amount: string;
  currency_amount: string;
  currency: string;
  bank_account: { id: number };
  customer: { id: number } | null;
  matched_invoices: Record<string, unknown>;
}

export interface PennylaneCustomerInvoice {
  id: number;
  label: string;
  invoice_number: string;
  amount: string;
  currency_amount: string;
  date: string;
  deadline: string;
  paid: boolean;
  status: string;
  customer: { id: number; url?: string };
  remaining_amount_with_tax: string;
}
