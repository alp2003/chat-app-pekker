import { test, expect } from '@playwright/test';

test.describe('Chat App - Smoke Tests', () => {
  test('should load the homepage without crashes', async ({ page }) => {
    await page.goto('/');

    // Page should load without critical errors
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title).not.toBe('');

    // Should not show actual error pages (more specific than looking for "500" in build output)
    const pageContent =
      (await page.locator('h1, h2, main, body').first().textContent()) || '';
    expect(pageContent).not.toContain('Internal Server Error');
    expect(pageContent).not.toContain('500 - Server Error');
    expect(pageContent).not.toContain('Application Error');

    // Should respond with valid status
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should be able to navigate to login page', async ({ page }) => {
    await page.goto('/login');

    // Page should load successfully
    await expect(page).toHaveURL(/login/);

    // Should have basic page structure
    const title = await page.title();
    expect(title).toBeTruthy();

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
  });

  test('should be able to navigate to register page', async ({ page }) => {
    await page.goto('/register');

    // Page should load successfully
    await expect(page).toHaveURL(/register/);

    // Should have basic page structure
    const title = await page.title();
    expect(title).toBeTruthy();

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check for basic meta tags
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('should not have console errors on homepage', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      error =>
        !error.includes('favicon.ico') &&
        !error.includes('_next/static') &&
        !error.includes('net::ERR_') && // Network errors during test
        !error.includes('WebSocket connection') && // WebSocket connection issues in test
        !error.includes('Failed to fetch') // Network fetch errors in test
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
