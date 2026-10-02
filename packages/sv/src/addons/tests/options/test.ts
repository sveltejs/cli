import { expect, it } from 'vitest';
import { officialAddons, type OfficialAddonOptions } from '../../index.ts';

it('exposes the option values of official add-ons, keyed by id', () => {
	// partial, like `add()` accepts: unanswered questions fall back to their default
	const drizzle: OfficialAddonOptions['drizzle'] = { database: 'sqlite', docker: false };
	const adapter: OfficialAddonOptions['sveltekit-adapter'] = { adapter: 'node' };

	// @ts-expect-error not a postgres driver
	const wrong: OfficialAddonOptions['drizzle'] = { postgresql: 'libsql' };

	expect([drizzle.database, adapter.adapter, wrong]).toBeTruthy();
	expect(officialAddons.drizzle.options.database.default).toBe('sqlite');
});
