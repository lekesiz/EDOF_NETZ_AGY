CREATE TABLE "auth_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_notes" (
	"email_key" text PRIMARY KEY NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "dossier_bon_achat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"email" text,
	"nom_prenom" text,
	"statut_parrainage" boolean,
	"montant_bon_achat" numeric,
	"montant_bon_filleul" numeric,
	"parrain" text,
	"total_bons" numeric,
	"fournisseur" text,
	"date_commande" date,
	"devis_numero" text,
	"statut_devis" text,
	"facture_numero" text,
	"statut_paiement" text,
	"livraison" text,
	"mode_paiement" text,
	"notes" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "dossier_bon_achat_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "dossier_contact_suivi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"email" text,
	"nom_prenom" text,
	"intitule_formation" text,
	"statut" text,
	"dates_session" text,
	"moyen_contact" text,
	"date_contact" date,
	"reponse_recue" text,
	"notes" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "dossier_contact_suivi_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"variables" text DEFAULT '',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dossiers" ALTER COLUMN "amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "dossiers" ALTER COLUMN "amount" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "dossiers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dossiers" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "sent_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "billing_state" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "not_processed_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "validated_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "accepted_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "in_training_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "terminated_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "service_done_declared_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "service_done_validated_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "billed_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "certification_state" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "attendee_state" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "control_state" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "completion_rate" numeric;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "payment_due_date" date;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "dossier_name" text;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE INDEX "idx_bon_achat_email" ON "dossier_bon_achat" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contact_email" ON "dossier_contact_suivi" USING btree ("email");