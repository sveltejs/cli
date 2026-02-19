import { expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import betterAuth from '../../better-auth.ts';
import drizzle from '../../drizzle.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases, prepareServer } = setupTest(
	{ drizzle, betterAuth },
	{
		kinds: [
			{
				type: 'default',
				options: {
					drizzle: { database: 'sqlite', sqlite: 'turso' },
					'better-auth': { demo: ['password', 'github'] }
				}
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

const ONE_MINUTE = 1000 * 60;
const timeout = process.platform === 'win32' ? ONE_MINUTE * 5 : ONE_MINUTE * 3;

test.concurrent.for(testCases)('better-auth $variant', { timeout }, async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);
	const language = testCase.variant.includes('ts') ? 'ts' : 'js';

	// Verify that we have a demo login
	const loginPage = path.resolve(cwd, `src/routes/demo/better-auth/login/+page.svelte`);
	expect(fs.existsSync(loginPage)).toBe(true);

	// For Turso, update .env to use local SQLite file instead of remote URL
	const envPath = path.resolve(cwd, '.env');
	let envContent = fs.readFileSync(envPath, 'utf8');
	envContent = envContent.replace(/DATABASE_URL=".*"/, 'DATABASE_URL="file:local.db"');
	fs.writeFileSync(envPath, envContent, 'utf8');

	// Generate auth schema using better-auth CLI
	execSync('npm run auth:schema', { cwd, stdio: 'pipe' });

	// Verify schema has auth tables
	const schemaPath = path.resolve(cwd, `src/lib/server/db/schema.${language}`);
	const schemaContent = fs.readFileSync(schemaPath, 'utf8');
	expect(schemaContent).toContain('export *');
	expect(schemaContent).toContain('./auth.schema');

	// Push schema to DB
	execSync('npm run db:push -- --force', { cwd, stdio: 'pipe' });

	/** ----- BROWSER SECTION ----- */
	const { url, close } = await prepareServer({ cwd, page });
	ctx.onTestFinished(async () => await close());

	await page.goto(`${url}demo/better-auth`);

	// Verify login page loaded (contains email input)
	const emailInput = page.locator('input[type="email"]');
	await expect(emailInput).toBeVisible();

	// Fill registration form and submit
	const userName = `Test_User_${Date.now()}`;
	await emailInput.fill(`${userName}@example.com`);
	await page.fill('input[type="password"]', 'testpassword123');
	await page.locator('input').nth(2).fill(userName);

	// Click register button
	await page.click('button:has-text("Register")');

	// // Wait for navigation to authenticated page
	await page.waitForURL(`${url}demo/better-auth`, { timeout: 3000 });

	// Verify user name is displayed
	await expect(page.locator('h1')).toContainText(userName);

	// Reload page and verify still connected
	await page.reload();
	await expect(page.locator('h1')).toContainText(userName);

	// Sign out
	await page.click('button:has-text("Sign out")');
	await page.waitForURL(`${url}demo/better-auth/login`, { timeout: 3000 });

	// Verify we're logged out (email input visible again)
	await expect(emailInput).toBeVisible();
});
