import { log } from '@clack/prompts';
import { color, dedent, transforms } from '@sveltejs/sv-utils';
import { stripVersionRange } from '../core/common.ts';
import { defineAddon } from '../core/config.ts';
import { addEslintConfigPrettier, ESLINT_VERSION } from './common.ts';

export default defineAddon({
	id: 'prettier',
	shortDescription: 'formatter',
	homepage: 'https://prettier.io',
	options: {},
	run: ({ sv, dependencyVersion, file }) => {
		const tailwindcssInstalled = Boolean(dependencyVersion('tailwindcss'));
		if (tailwindcssInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.7.2');

		sv.devDependency('prettier', '^3.8.1');
		sv.devDependency('prettier-plugin-svelte', '^3.5.1');

		sv.file(
			'.prettierignore',
			transforms.text(({ content }) => {
				if (content) return false;
				return dedent`
					# Package Managers
					package-lock.json
					pnpm-lock.yaml
					yarn.lock
					bun.lock
					bun.lockb

					# Miscellaneous
					/static/
				`;
			})
		);

		sv.file(
			'.prettierrc',
			transforms.json(
				({ data, json }) => {
					if (Object.keys(data).length === 0) {
						// we'll only set these defaults if there is no pre-existing config
						data.useTabs = true;
						data.singleQuote = true;
						data.trailingComma = 'none';
						data.printWidth = 100;
					}

					json.arrayUpsert(data, 'plugins', 'prettier-plugin-svelte');

					if (tailwindcssInstalled) {
						json.arrayUpsert(data, 'plugins', 'prettier-plugin-tailwindcss');
						data.tailwindStylesheet ??= file.getRelative({ to: file.stylesheet });
					}

					data.overrides ??= [];
					const overrides: Array<{ files: string | string[]; options?: { parser?: string } }> =
						data.overrides;
					const override = overrides.find((o) => o?.options?.parser === 'svelte');
					if (!override) {
						overrides.push({ files: '*.svelte', options: { parser: 'svelte' } });
					}
				},
				{
					onError: () => {
						log.warn(
							`A ${color.warning('.prettierrc')} config already exists and cannot be parsed as JSON. Skipping initialization.`
						);
					}
				}
			)
		);

		const eslintVersion = dependencyVersion('eslint');
		const eslintInstalled = hasEslint(eslintVersion);

		sv.file(
			file.package,
			transforms.json(({ data, json }) => {
				json.packageScriptsUpsert(data, 'lint', 'prettier --check .', { mode: 'prepend' });
				json.packageScriptsUpsert(data, 'format', 'prettier --write .');
			})
		);

		sv.file(
			'.vscode/extensions.json',
			transforms.json(({ data, json }) => {
				json.arrayUpsert(data, 'recommendations', 'esbenp.prettier-vscode');
			})
		);

		if (eslintVersion?.startsWith(SUPPORTED_ESLINT_VERSION) === false) {
			log.warn(
				`An unsupported major version of ${color.warning(
					'eslint'
				)} was detected. Skipping ${color.warning('eslint-config-prettier')} installation.`
			);
		}

		if (eslintInstalled) {
			sv.devDependency('eslint-config-prettier', '^10.1.8');
			sv.file('eslint.config.js', addEslintConfigPrettier);
		}
	}
});

const SUPPORTED_ESLINT_VERSION = stripVersionRange(ESLINT_VERSION).split('.')[0];

function hasEslint(version: string | undefined): boolean {
	return !!version && version.startsWith(SUPPORTED_ESLINT_VERSION);
}
