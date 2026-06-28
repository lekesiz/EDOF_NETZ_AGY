import { Resend } from 'resend';
import { db } from '@/db/db';
import { emailLogs, emailQueue, dossiers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY || 'mock-resend-key';

let resend: Resend | null = null;
if (RESEND_API_KEY && RESEND_API_KEY !== 'mock-resend-key') {
  resend = new Resend(RESEND_API_KEY);
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends a HTML e-mail using the Resend API
 */
export async function sendEmail(payload: EmailPayload): Promise<string> {
  const fromEmail = process.env.EMAIL_FROM || 'EDOF Dashboard <netz@netzinformatique.fr>';
  
  if (!resend) {
    console.warn(`[Emails] RESEND_API_KEY not configured. Simulating email to ${payload.to}`);
    // Return a mock ID
    return `mock-resend-id-${crypto.randomUUID()}`;
  }

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  if (error) {
    throw new Error(`Resend send error: ${error.message}`);
  }

  return data?.id || `resend-id-${Date.now()}`;
}

/**
 * Gets HTML templates for e-mail types (Anniversary, Satisfaction Survey)
 */
export function getEmailTemplate(type: string, firstName: string = ''): { subject: string; html: string } {
  const name = firstName ? ` ${firstName}` : '';
  
  if (type === 'bday') {
    return {
      subject: `🎂 Joyeux Anniversaire${name} !`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 25px; background-color: #09090b; color: #fafafa; border-radius: 16px; border: 1px solid #27272a;">
          <h2 style="color: #3b82f6; text-align: center; margin-bottom: 20px;">🎂 Joyeux Anniversaire !</h2>
          <p>Bonjour${name},</p>
          <p>Toute l'équipe de <strong>NETZ INFORMATIQUE</strong> vous souhaite un excellent anniversaire !</p>
          <p>Nous espérons que vos projets professionnels se déroulent au mieux et que votre formation continue de vous ouvrir de nouvelles portes.</p>
          <hr style="border: 0; border-top: 1px solid #27272a; margin: 25px 0;" />
          <p style="font-size: 10px; color: #52525b; text-align: center; margin-bottom: 0;">NETZ INFORMATIQUE - EDOF Dashboard</p>
        </div>
      `,
    };
  }

  if (type === 'survey1') {
    return {
      subject: `📝 Votre avis compte ! (Enquête de satisfaction J+1)`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 25px; background-color: #09090b; color: #fafafa; border-radius: 16px; border: 1px solid #27272a;">
          <h2 style="color: #10b981; text-align: center; margin-bottom: 20px;">📝 Enquête de Satisfaction</h2>
          <p>Bonjour${name},</p>
          <p>Votre formation vient de se terminer. Afin d'améliorer continuellement la qualité de nos formations, merci de prendre 2 minutes pour remplir notre enquête de satisfaction post-formation.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://forms.gle/sampleSurvey1" style="background-color: #10b981; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">Répondre à l'enquête</a>
          </div>
          <p>Merci pour votre confiance !</p>
          <hr style="border: 0; border-top: 1px solid #27272a; margin: 25px 0;" />
          <p style="font-size: 10px; color: #52525b; text-align: center; margin-bottom: 0;">NETZ INFORMATIQUE - EDOF Dashboard</p>
        </div>
      `,
    };
  }

  if (type === 'survey6') {
    return {
      subject: `📝 Que devenez-vous ? (Suivi de formation à 6 mois)`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 25px; background-color: #09090b; color: #fafafa; border-radius: 16px; border: 1px solid #27272a;">
          <h2 style="color: #f59e0b; text-align: center; margin-bottom: 20px;">📝 Suivi de Formation à 6 Mois</h2>
          <p>Bonjour${name},</p>
          <p>Voilà déjà 6 mois que vous avez terminé votre parcours de formation chez nous.</p>
          <p>Dans le cadre de nos engagements qualité et de notre suivi des diplômés, nous aimerions savoir où vous en êtes dans vos projets (emploi, reconversion, etc.).</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://forms.gle/sampleSurvey6" style="background-color: #f59e0b; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);">Donner de mes nouvelles</a>
          </div>
          <p>À très bientôt,</p>
          <hr style="border: 0; border-top: 1px solid #27272a; margin: 25px 0;" />
          <p style="font-size: 10px; color: #52525b; text-align: center; margin-bottom: 0;">NETZ INFORMATIQUE - EDOF Dashboard</p>
        </div>
      `,
    };
  }

  throw new Error(`Unknown email type: ${type}`);
}

/**
 * Processes a single email queue item (approves & sends)
 */
export async function processQueueItem(queueId: string): Promise<string> {
  const [item] = await db.select({
    id: emailQueue.id,
    dossierId: emailQueue.dossierId,
    email: emailQueue.email,
    emailType: emailQueue.emailType,
    status: emailQueue.status,
    firstName: dossiers.firstName,
  })
  .from(emailQueue)
  .leftJoin(dossiers, eq(emailQueue.dossierId, dossiers.id))
  .where(eq(emailQueue.id, queueId))
  .limit(1);

  if (!item) {
    throw new Error('Queue item not found');
  }

  if (item.status !== 'pending' && item.status !== 'failed') {
    throw new Error(`Cannot send email with status ${item.status}`);
  }

  try {
    const { subject, html } = getEmailTemplate(item.emailType, item.firstName || '');
    
    // Send email
    const resendId = await sendEmail({
      to: item.email,
      subject,
      html,
    });

    // Update queue status
    const now = new Date();
    await db.update(emailQueue)
      .set({
        status: 'sent',
        sentAt: now,
        errorMessage: null,
      })
      .where(eq(emailQueue.id, queueId));

    // Log in email_logs
    await db.insert(emailLogs).values({
      dossierId: item.dossierId,
      email: item.email,
      emailType: item.emailType,
      resendId,
      sentAt: now,
    });

    return resendId;
  } catch (err: any) {
    const errorMsg = err.message || 'Email sending failed';
    await db.update(emailQueue)
      .set({
        status: 'failed',
        errorMessage: errorMsg,
      })
      .where(eq(emailQueue.id, queueId));
      
    throw err;
  }
}
