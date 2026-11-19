import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { expect } from '@playwright/test';
import { execSync } from 'tinyexec';
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
			},
			{
				type: 'mock-github',
				options: {
					drizzle: { database: 'sqlite', sqlite: 'turso' },
					'better-auth': { demo: ['github-mock'] }
				}
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

test.concurrent.for(testCases)('better-auth $variant', async (testCase, { page, ...ctx }) => {
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
	execSync('npm', ['run', 'auth:schema'], { nodeOptions: { cwd }, throwOnError: true });

	// Verify schema has auth tables
	const schemaPath = path.resolve(cwd, `src/lib/server/db/schema.${language}`);
	const schemaContent = fs.readFileSync(schemaPath, 'utf8');
	expect(schemaContent).toContain('export *');
	expect(schemaContent).toContain('./auth.schema');

	// Push schema to DB
	execSync('npm', ['run', 'db:push', '--', '--force'], {
		nodeOptions: { cwd },
		throwOnError: true
	});

	/** ----- BROWSER SECTION ----- */
	const isMockGithub = testCase.kind.type === 'mock-github';
	const mockPort = testCase.variant === 'kit-ts' ? 41732 : 41731;
	if (isMockGithub) {
		envContent = envContent.replace(/ORIGIN=".*"/, `ORIGIN="http://127.0.0.1:${mockPort}"`);
		fs.writeFileSync(envPath, envContent, 'utf8');
	}
	const { url, close } = await prepareServer({
		cwd,
		page,
		...(isMockGithub
			? { buildCommand: '', previewCommand: `pnpm dev --host 127.0.0.1 --port ${mockPort}` }
			: {})
	});
	ctx.onTestFinished(async () => await close());

	await page.goto(`${url}demo/better-auth`);

	// Verify the opt-in GitHub demo redirects to Mockatoo without credentials.
	if (isMockGithub) {
		const authContent = fs.readFileSync(
			path.resolve(cwd, `src/lib/server/auth.${language}`),
			'utf8'
		);
		expect(authContent).toContain("from '@mockatoo/connect-better-auth'");
		expect(authContent).toContain('socialProviders: dev');

		await page.goto(`${url}demo/better-auth/login`);
		await page.getByRole('button', { name: 'Sign in with GitHub' }).click();
		await expect(page).toHaveURL(/https:\/\/app\.mockatoo\.globalunderdog\.com\/login\?next=/);
		await expect(page.locator('#email')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Log in with password' })).toBeVisible();

		const email = process.env.MOCKATOO_TEST_EMAIL;
		const password = process.env.MOCKATOO_TEST_PASSWORD;
		if (!email || !password) {
			console.log('::notice::Skipping Mockatoo full sign-in: test credentials are missing');
			ctx.skip(true, 'MOCKATOO_TEST_EMAIL and MOCKATOO_TEST_PASSWORD are required');
			return;
		}

		await page.locator('#email').fill(email);
		await page.locator('#password').fill(password);
		await page.getByRole('button', { name: 'Log in with password' }).click();
		await page.getByRole('button', { name: 'Authorize' }).click();
		await expect(page).toHaveURL(`${url}demo/better-auth`);
		await expect(page.locator('h1')).toContainText('Hi,');
		return;
	}

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
