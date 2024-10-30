import { dedent, defineAdder, log, colors } from '@sveltejs/cli-core';
import { addEslintConfigPrettier } from '../common.ts';
import { parseJson } from '@sveltejs/cli-core/parsers';

export default defineAdder({
	id: 'prettier',
	homepage: 'https://prettier.io',
	options: {},
	run: ({ sv, dependencyVersion }) => {
		const eslintInstalled = hasEslint(dependencyVersion);

		sv.devDependency('prettier', '^3.3.2');
		sv.devDependency('prettier-plugin-svelte', '^3.2.6');

		if (eslintInstalled) sv.devDependency('eslint-config-prettier', '^9.1.0');

		sv.file('.prettierignore', (content) => {
			if (content) return content;
			return dedent`
				# Package Managers
				package-lock.json
				pnpm-lock.yaml
				yarn.lock
			`;
		});

		sv.file('.prettierrc', (content) => {
			const { data, generateCode } = parseJson(content);
			if (Object.keys(data).length === 0) {
				// we'll only set these defaults if there is no pre-existing config
				data.useTabs = true;
				data.singleQuote = true;
				data.trailingComma = 'none';
				data.printWidth = 100;
			}

			data.plugins ??= [];
			data.overrides ??= [];

			const plugins: string[] = data.plugins;
			if (!plugins.includes('prettier-plugin-svelte')) {
				data.plugins.unshift('prettier-plugin-svelte');
			}

			const overrides: Array<{ files: string | string[]; options?: { parser?: string } }> =
				data.overrides;
			const override = overrides.find((o) => o?.options?.parser === 'svelte');
			if (!override) {
				overrides.push({ files: '*.svelte', options: { parser: 'svelte' } });
			}
			return generateCode();
		});

		sv.file('package.json', (content) => {
			const { data, generateCode } = parseJson(content);

			data.scripts ??= {};
			const scripts: Record<string, string> = data.scripts;
			const CHECK_CMD = 'prettier --check .';
			scripts['format'] ??= 'prettier --write .';

			if (hasEslint(dependencyVersion)) {
				scripts['lint'] ??= `${CHECK_CMD} && eslint .`;
				if (!scripts['lint'].includes(CHECK_CMD)) scripts['lint'] += ` && ${CHECK_CMD}`;
			} else {
				scripts['lint'] ??= CHECK_CMD;
			}
			return generateCode();
		});

		if (dependencyVersion('eslint')?.startsWith(SUPPORTED_ESLINT_VERSION) === false) {
			log.warn(
				`An older major version of ${colors.yellow(
					'eslint'
				)} was detected. Skipping ${colors.yellow('eslint-config-prettier')} installation.`
			);
		}
		if (eslintInstalled) {
			sv.file('eslint.config.js', addEslintConfigPrettier);
		}
	}
});

const SUPPORTED_ESLINT_VERSION = '9';

function hasEslint(dependencyVersion: (pkg: string) => string | undefined): boolean {
	const version = dependencyVersion('eslint');
	return !!version && version.startsWith(SUPPORTED_ESLINT_VERSION);
}
