import { transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';
import { createOxfmtConfig, oxfmtConfigPath } from './common.ts';
import { ADDON_IDS } from './ids.ts';

export default defineAddon({
	id: ADDON_IDS.oxfmt,
	shortDescription: 'formatter',
	homepage: 'https://oxc.rs/docs/guide/usage/formatter.html',
	options: {},
	run: ({ sv, dependencyVersion, file }) => {
		const tailwindcssInstalled = Boolean(dependencyVersion('tailwindcss'));
		// TODO: check if prettier is installed

		sv.devDependency('oxfmt', '^0.70.0');

		sv.file(
			oxfmtConfigPath(),
			createOxfmtConfig({
				tailwind: tailwindcssInstalled
			})
		);

		sv.file(
			file.package,
			transforms.json(({ data, json }) => {
				json.packageScriptsUpsert(data, 'fmt', 'oxfmt');
				json.packageScriptsUpsert(data, 'fmt:check', 'oxfmt --check');
			})
		);

		sv.file(
			'.vscode/extensions.json',
			transforms.json(({ data, json }) => {
				json.arrayUpsert(data, 'recommendations', 'oxc.oxc-vscode');
			})
		);
	}
});
