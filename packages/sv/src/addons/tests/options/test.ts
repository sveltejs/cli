import { expect, it } from 'vitest';
import { officialAddons, type OfficialAddonOptions } from '../../index.ts';

it('exposes the option values of official add-ons', () => {
	const drizzle: OfficialAddonOptions['drizzle'] = {
		database: 'sqlite',
		sqlite: 'libsql',
		// @ts-expect-error not a postgres driver
		postgresql: 'libsql',
		mysql: 'mysql2',
		docker: false
	};

	expect(drizzle.database).toBe('sqlite');
	expect(officialAddons.drizzle.options.database.default).toBe('sqlite');
});
