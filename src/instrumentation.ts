export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[App Startup] Server starting. Initializing cron scheduler...');
    try {
      const { initBackgroundScheduler } = await import('@/lib/scheduler');
      initBackgroundScheduler();
    } catch (e) {
      console.error('[App Startup] Failed to initialize background scheduler:', e);
    }
  }
}
