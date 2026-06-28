import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { settings } from '@/db/schema';
import { validateSession, unauthorizedResponse } from '@/lib/api-auth';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET: Retrieve all settings
export async function GET() {
  try {
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const data = await db.select().from(settings).orderBy(settings.key);

    const formattedSettings: Record<string, { value: string; updated_at: string }> = {};
    for (const row of data) {
      formattedSettings[row.key] = {
        value: row.value,
        updated_at: row.updatedAt.toISOString(),
      };
    }

    return NextResponse.json(formattedSettings);
  } catch (error: any) {
    console.error('--- API settings GET error:', error);
    const errorMessage = error.message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT: Update a setting
export async function PUT(request: NextRequest) {
  try {
    const email = await validateSession();
    if (!email) return unauthorizedResponse();

    const { key, value } = await request.json();

    if (!key || value === undefined || value === null) {
      return NextResponse.json({ error: 'Clé et valeur sont obligatoires' }, { status: 400 });
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return NextResponse.json({ error: 'La valeur doit être numérique' }, { status: 400 });
    }

    // Check if the setting exists, if not insert it, if yes update it
    const [existing] = await db.select().from(settings).where(eq(settings.key, key));
    
    if (existing) {
      await db.update(settings)
        .set({
          value: String(numValue),
          updatedAt: new Date(),
        })
        .where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({
        key,
        value: String(numValue),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, message: `Setting ${key} updated` });
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
