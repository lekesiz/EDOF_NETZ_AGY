import { test, expect } from '@playwright/test';
import { encryptSession } from '../../src/lib/crypto';

test.describe('EDOF Financial Dashboard & CRM E2E Flows', () => {

  test.beforeEach(async ({ context }, testInfo) => {
    if (!testInfo.title.includes('authenticate successfully')) {
      const sessionToken = await encryptSession('admin@netzinformatique.fr', 24 * 60 * 60 * 1000);
      await context.addCookies([
        {
          name: 'edof_session',
          value: sessionToken,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        }
      ]);
    }
  });

  test('should load the dashboard and display key metrics', async ({ page }) => {
    // 1. Go to dashboard home
    await page.goto('/', { waitUntil: 'commit' });

    // 2. Verify title and structure
    await expect(page.locator('h1')).toContainText('EDOF Dashboard');
    await expect(page.locator('h2')).toContainText('Rapport financier');

    // 3. Verify KPI cards are rendered with seeded data
    const encaisseCard = page.locator('text=Encaissé (Échu)').first();
    await expect(encaisseCard).toBeVisible();

    const enAttenteCard = page.locator('text=En attente (À venir)').first();
    await expect(enAttenteCard).toBeVisible();

    const annuleCard = page.locator('text=Annulé / Perdu').first();
    await expect(annuleCard).toBeVisible();
  });

  test('should navigate to dossiers list, search for a learner, and open details', async ({ page }) => {
    // 1. Go to dossiers list page
    await page.goto('/dossiers', { waitUntil: 'commit' });

    // 2. Verify we are on dossiers page
    await expect(page.locator('h2')).toContainText('Liste des Dossiers');
    await expect(page.locator('table')).toBeVisible();

    // 3. Search for "Ahmet"
    await page.fill('input[placeholder*="Rechercher par nom"]', 'Ahmet');
    await page.press('input[placeholder*="Rechercher par nom"]', 'Enter');

    // 4. Verify YILMAZ Ahmet is listed
    await expect(page.locator('text=YILMAZ Ahmet')).toBeVisible();
    await expect(page.locator('text=EDOF-2026-0001')).toBeVisible();

    // 5. Click on the row to navigate to details
    await page.click('text=YILMAZ Ahmet');
    
    // 6. Verify detail view elements
    await expect(page.locator('h2')).toContainText('YILMAZ Ahmet');
    await expect(page.locator('text=ID DOSSIER: EDOF-2026-0001')).toBeVisible();
    await expect(page.locator('text=1 500')).toBeVisible();
  });

  test('should load billing logs history page', async ({ page }) => {
    await page.goto('/billing', { waitUntil: 'commit' });
    await expect(page.locator('h2')).toContainText('Journal de Facturation');
    await expect(page.locator('button:has-text("Lancer le cycle auto")')).toBeVisible();
  });

  test('should load bank reconciliation page and show unreconciled list', async ({ page }) => {
    await page.goto('/rapprochement', { waitUntil: 'commit' });
    await expect(page.locator('h2')).toContainText('Rapprochement Bancaire');
    await expect(page.locator('text=Dossiers en attente de paiement')).toBeVisible();
  });

  test('should load settings page and save a setting update', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'commit' });
    await expect(page.locator('h2')).toContainText('Configuration Système');

    // Verify inputs exist
    const vadeInput = page.locator('input#vade_gun');
    await expect(vadeInput).toBeVisible();

    // Type a new value
    await vadeInput.clear();
    await vadeInput.fill('30');

    // Click save button next to the input
    await page.click('button:has-text("Sauvegarder")');

    // Verify success banner is shown
    await expect(page.locator('text=enregistré avec succès')).toBeVisible();
  });

  test('should load the login page and authenticate successfully with admin credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'commit' });
    await expect(page.locator('h2')).toContainText('Connexion Admin');
    
    // Fill credentials
    await page.fill('input[type="email"]', 'admin@netzinformatique.fr');
    await page.fill('input[type="password"]', 'admin');
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Should log in and redirect to home dashboard
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should load webhooks logging page', async ({ page }) => {
    await page.goto('/webhooks', { waitUntil: 'commit' });
    await expect(page.locator('h2')).toContainText('Journal des Webhooks');
    await expect(page.locator('button:has-text("Rafraîchir")')).toBeVisible();
  });

});


