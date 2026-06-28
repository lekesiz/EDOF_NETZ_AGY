CREATE TABLE "billing_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"dossier_external_id" text NOT NULL,
	"dossier_first_name" text,
	"dossier_last_name" text,
	"amount" numeric(10, 2),
	"pennylane_invoice_number" text,
	"pennylane_invoice_id" text,
	"status" text NOT NULL,
	"error_message" text,
	"failed_step" text,
	"triggered_by" text DEFAULT 'cron' NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_step_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_log_id" uuid,
	"dossier_external_id" text NOT NULL,
	"step_name" text NOT NULL,
	"step_order" integer NOT NULL,
	"status" text NOT NULL,
	"input_data" jsonb,
	"output_data" jsonb,
	"error_message" text,
	"error_code" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"dob" date,
	"email" text,
	"phone" text,
	"training_title" text,
	"start_date" date,
	"end_date" date,
	"wedof_status" text NOT NULL,
	"amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"wedof_paid_date" date,
	"pennylane_paid_date" date,
	"pennylane_invoice_number" text,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dossiers_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid,
	"email" text NOT NULL,
	"email_type" text NOT NULL,
	"resend_id" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pennylane_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_date" date,
	"is_paid" boolean DEFAULT false NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pennylane_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_step_logs" ADD CONSTRAINT "billing_step_logs_billing_log_id_billing_logs_id_fk" FOREIGN KEY ("billing_log_id") REFERENCES "public"."billing_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE cascade ON UPDATE no action;