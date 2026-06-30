import { defineAddon } from '../core/config.ts';

export default defineAddon({
	id: 'valibot',
	shortDescription: 'schema validation',
	homepage: 'https://valibot.dev',
	options: {},
	run: ({ sv }) => {
		sv.devDependency('valibot', '^1.4.1');
	}
});
