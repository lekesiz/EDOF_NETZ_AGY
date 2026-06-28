import { db } from '@/db/db';
import { emailTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type EmailTemplate = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  variables: string | null;
  updatedAt: Date;
};

export async function getEmailTemplate(key: string): Promise<EmailTemplate | null> {
  try {
    const [data] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1);
    if (!data) return null;
    return {
      key: data.key,
      label: data.label,
      description: data.description,
      enabled: data.enabled,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      variables: data.variables,
      updatedAt: data.updatedAt,
    };
  } catch (error: any) {
    console.error(`[email-templates] Erreur lecture "${key}":`, error.message);
    return null;
  }
}

export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v == null ? '' : String(v);
  });
}

export function renderEmailTemplate(
  tpl: EmailTemplate,
  vars: Record<string, string | null | undefined>
): { subject: string; html: string } {
  return {
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.bodyHtml, vars),
  };
}
