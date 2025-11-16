import { dedent, defineAddon, log, colors } from '@sveltejs/cli-core';
import { addEslintConfigPrettier } from '../common.ts';
import { parseJson } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'prettier',
	shortDescription: 'formatter',
	homepage: 'https://prettier.io',
	options: {},
	run: ({ sv, dependencyVersion, kit }) => {
		const tailwindcssInstalled = Boolean(dependencyVersion('tailwindcss'));
		if (tailwindcssInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.7.1');

		sv.devDependency('prettier', '^3.6.2');
		sv.devDependency('prettier-plugin-svelte', '^3.4.0');

		sv.file('.prettierignore', (content) => {
			if (content) return content;
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
		});

		sv.file('.prettierrc', (content) => {
			let data, generateCode;
			try {
				({ data, generateCode } = parseJson(content));
			} catch {
				log.warn(
					`A ${colors.yellow('.prettierrc')} config already exists and cannot be parsed as JSON. Skipping initialization.`
				);
				return content;
			}
			if (Object.keys(data).length === 0) {
				// we'll only set these defaults if there is no pre-existing config
				data.useTabs = true;
				data.singleQuote = true;
				data.trailingComma = 'none';
				data.printWidth = 100;
			}

			data.plugins ??= [];
			const plugins: string[] = data.plugins;
			if (tailwindcssInstalled) {
				if (!plugins.includes('prettier-plugin-tailwindcss')) {
					data.plugins.unshift('prettier-plugin-tailwindcss');
				}
				data.tailwindStylesheet ??= './src/app.css';
				data.tailwindStylesheet ??= kit ? `${kit?.routesDirectory}/layout.css` : './src/app.css';
			}
			if (!plugins.includes('prettier-plugin-svelte')) {
				data.plugins.unshift('prettier-plugin-svelte');
			}

			data.overrides ??= [];
			const overrides: Array<{ files: string | string[]; options?: { parser?: string } }> =
				data.overrides;
			const override = overrides.find((o) => o?.options?.parser === 'svelte');
			if (!override) {
				overrides.push({ files: '*.svelte', options: { parser: 'svelte' } });
			}
			return generateCode();
		});

		const eslintVersion = dependencyVersion('eslint');
		const eslintInstalled = hasEslint(eslintVersion);

		sv.file('package.json', (content) => {
			const { data, generateCode } = parseJson(content);

			data.scripts ??= {};
			const scripts: Record<string, string> = data.scripts;
			const CHECK_CMD = 'prettier --check .';
			scripts['format'] ??= 'prettier --write .';

			if (eslintInstalled) {
				scripts['lint'] ??= `${CHECK_CMD} && eslint .`;
				if (!scripts['lint'].includes(CHECK_CMD)) scripts['lint'] += ` && ${CHECK_CMD}`;
			} else {
				scripts['lint'] ??= CHECK_CMD;
			}
			return generateCode();
		});

		if (eslintVersion?.startsWith(SUPPORTED_ESLINT_VERSION) === false) {
			log.warn(
				`An older major version of ${colors.yellow(
					'eslint'
				)} was detected. Skipping ${colors.yellow('eslint-config-prettier')} installation.`
			);
		}

		if (eslintInstalled) {
			sv.devDependency('eslint-config-prettier', '^10.1.8');
			sv.file('eslint.config.js', addEslintConfigPrettier);
		}
	}
});

const SUPPORTED_ESLINT_VERSION = '9';

function hasEslint(version: string | undefined): boolean {
	return !!version && version.startsWith(SUPPORTED_ESLINT_VERSION);
}
