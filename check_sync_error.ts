import { db } from './src/db/db';
import { syncLogs } from './src/db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  console.log('Fetching latest failed sync log...');
  const logs = await db.select()
    .from(syncLogs)
    .where(eq(syncLogs.status, 'failed'))
    .orderBy(desc(syncLogs.createdAt))
    .limit(5);

  console.log('Failed Logs count:', logs.length);
  for (const log of logs) {
    console.log('-------------------');
    console.log('Type:', log.syncType);
    console.log('Created At:', log.createdAt);
    console.log('Error Message:', log.errorMessage);
  }
}

main().catch(console.error);
