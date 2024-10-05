import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser;
const headless = true;

export async function startBrowser(): Promise<void> {
	browser = await chromium.launch({ headless });
	console.log('browser started');
}

export async function openPage(url: string): Promise<Page> {
	const page = await browser.newPage();

	await page.goto(url, { timeout: 60_000 });
	await page.waitForLoadState('networkidle');

	// always use light mode. Otherwise the tests might depend on the OS setting
	// of each developer and thus leads to inconsistent test results.
	await page.emulateMedia({ colorScheme: 'light' });

	return page;
}

export async function stopBrowser(): Promise<void> {
	if (!browser) return;
	await browser.close();
}
