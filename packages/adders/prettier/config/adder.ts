import { dedent, defineAdder, log, colors } from '@svelte-cli/core';
import { options } from './options.ts';
import { addEslintConfigPrettier } from '../../common.ts';
import { parseJson } from '@svelte-cli/core/parsers';

export const adder = defineAdder({
	id: 'prettier',
	name: 'Prettier',
	description: 'An opinionated code formatter',
	environments: { svelte: true, kit: true },
	logo: './prettier.svg',
	documentation: 'https://prettier.io',
	options,
	packages: [
		{ name: 'prettier', version: '^3.3.2', dev: true },
		{ name: 'prettier-plugin-svelte', version: '^3.2.6', dev: true },
		{
			name: 'eslint-config-prettier',
			version: '^9.1.0',
			dev: true,
			condition: ({ dependencyVersion }) => hasEslint(dependencyVersion)
		}
	],
	files: [
		{
			name: () => '.prettierignore',
			content: ({ content }) => {
				if (content) return content;
				return dedent`
                    # Package Managers
                    package-lock.json
                    pnpm-lock.yaml
                    yarn.lock
                `;
			}
		},
		{
			name: () => '.prettierrc',
			content: ({ content }) => {
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
			}
		},
		{
			name: () => 'package.json',
			content: ({ content, dependencyVersion }) => {
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
			}
		},
		{
			name: () => 'eslint.config.js',
			condition: ({ dependencyVersion }) => {
				// We only want this to execute when it's `false`, not falsy

				if (dependencyVersion('eslint')?.startsWith(SUPPORTED_ESLINT_VERSION) === false) {
					log.warn(
						`An older major version of ${colors.yellow(
							'eslint'
						)} was detected. Skipping ${colors.yellow('eslint-config-prettier')} installation.`
					);
				}
				return hasEslint(dependencyVersion);
			},
			content: addEslintConfigPrettier
		}
	]
});

const SUPPORTED_ESLINT_VERSION = '9';

function hasEslint(dependencyVersion: (pkg: string) => string | undefined): boolean {
	const version = dependencyVersion('eslint');
	return !!version && version.startsWith(SUPPORTED_ESLINT_VERSION);
}
