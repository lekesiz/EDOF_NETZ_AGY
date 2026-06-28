import { pgTable, uuid, text, numeric, date, timestamp, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core';

// 1. Dossiers (Eğitim Dosyaları)
export const dossiers = pgTable('dossiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').unique().notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  dob: date('dob'),
  email: text('email'),
  phone: text('phone'),
  trainingTitle: text('training_title'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  wedofStatus: text('wedof_status').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  wedofPaidDate: date('wedof_paid_date'),
  pennylanePaidDate: date('pennylane_paid_date'),
  pennylaneInvoiceNumber: text('pennylane_invoice_number'),
  isReconciled: boolean('is_reconciled').default(false).notNull(),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('dossiers_is_reconciled_idx').on(table.isReconciled),
  index('dossiers_amount_idx').on(table.amount),
  index('dossiers_last_name_idx').on(table.lastName),
  index('dossiers_end_date_idx').on(table.endDate),
]);

// 2. Pennylane Invoices Cache
export const pennylaneInvoices = pgTable('pennylane_invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: text('invoice_number').unique().notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paidDate: date('paid_date'),
  isPaid: boolean('is_paid').default(false).notNull(),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('pennylane_invoices_is_paid_idx').on(table.isPaid),
  index('pennylane_invoices_amount_idx').on(table.amount),
]);

// 3. Billing Logs (Ana Faturalama Operasyonları)
export const billingLogs = pgTable('billing_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id'),
  dossierExternalId: text('dossier_external_id').notNull(),
  dossierFirstName: text('dossier_first_name'),
  dossierLastName: text('dossier_last_name'),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  pennylaneInvoiceNumber: text('pennylane_invoice_number'),
  pennylaneInvoiceId: text('pennylane_invoice_id'),
  status: text('status').notNull(), // success, failed, pending
  errorMessage: text('error_message'),
  failedStep: text('failed_step'),
  triggeredBy: text('triggered_by').default('cron').notNull(), // cron, manual, api
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('billing_logs_dossier_idx').on(table.dossierExternalId),
  index('billing_logs_status_idx').on(table.status),
  index('billing_logs_created_at_idx').on(table.createdAt),
  index('billing_logs_run_id_idx').on(table.runId),
]);

// 4. Billing Step Logs (Detaylı Fatura Adımları Auditi)
export const billingStepLogs = pgTable('billing_step_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  billingLogId: uuid('billing_log_id').references(() => billingLogs.id, { onDelete: 'cascade' }),
  dossierExternalId: text('dossier_external_id').notNull(),
  stepName: text('step_name').notNull(),
  stepOrder: integer('step_order').notNull(),
  status: text('status').notNull(), // success, failed, skipped
  inputData: jsonb('input_data'),
  outputData: jsonb('output_data'),
  errorMessage: text('error_message'),
  errorCode: text('error_code'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('billing_step_logs_billing_log_idx').on(table.billingLogId),
  index('billing_step_logs_dossier_idx').on(table.dossierExternalId),
  index('billing_step_logs_step_name_idx').on(table.stepName),
  index('billing_step_logs_status_idx').on(table.status),
  index('billing_step_logs_created_at_idx').on(table.createdAt),
]);

// 5. Email Logs
export const emailLogs = pgTable('email_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  dossierId: uuid('dossier_id').references(() => dossiers.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  emailType: text('email_type').notNull(), // bday, survey1, survey6
  resendId: text('resend_id'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (table) => [
  index('email_logs_dossier_idx').on(table.dossierId),
  index('email_logs_email_type_idx').on(table.emailType),
]);

// 6. Sync Logs (Sistem Senkronizasyon Kayıtları)
export const syncLogs = pgTable('sync_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  syncType: text('sync_type').notNull(), // wedof, pennylane, billing
  status: text('status').notNull(), // success, failed
  recordsProcessed: integer('records_processed').default(0).notNull(),
  recordsCreated: integer('records_created').default(0).notNull(),
  recordsUpdated: integer('records_updated').default(0).notNull(),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('sync_logs_sync_type_idx').on(table.syncType),
  index('sync_logs_status_idx').on(table.status),
]);

// 7. Settings (Global Ayarlar)
export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
