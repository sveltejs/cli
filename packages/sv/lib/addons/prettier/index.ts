import { addEslintConfigPrettier, dedent, defineAddon, log, parseJson, color } from '../../core.ts';

export default defineAddon({
	id: 'prettier',
	shortDescription: 'formatter',
	homepage: 'https://prettier.io',
	options: {},
	run: ({ sv, dependencyVersion, files }) => {
		const tailwindcssInstalled = Boolean(dependencyVersion('tailwindcss'));
		if (tailwindcssInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.7.2');

		sv.devDependency('prettier', '^3.7.4');
		sv.devDependency('prettier-plugin-svelte', '^3.4.0');

		sv.file(files.prettierignore, (content) => {
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

		sv.file(files.prettierrc, (content) => {
			let data, generateCode;
			try {
				({ data, generateCode } = parseJson(content));
			} catch {
				log.warn(
					`A ${color.warning('.prettierrc')} config already exists and cannot be parsed as JSON. Skipping initialization.`
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
			{
				const PLUGIN_NAME = 'prettier-plugin-svelte';
				if (!plugins.includes(PLUGIN_NAME)) plugins.push(PLUGIN_NAME);
			}
			if (tailwindcssInstalled) {
				const PLUGIN_NAME = 'prettier-plugin-tailwindcss';
				if (!plugins.includes(PLUGIN_NAME)) plugins.push(PLUGIN_NAME);
				data.tailwindStylesheet ??= files.getRelative({ to: files.stylesheet });
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

		sv.file(files.package, (content) => {
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
				`An older major version of ${color.warning(
					'eslint'
				)} was detected. Skipping ${color.warning('eslint-config-prettier')} installation.`
			);
		}

		if (eslintInstalled) {
			sv.devDependency('eslint-config-prettier', '^10.1.8');
			sv.file(files.eslintConfig, addEslintConfigPrettier);
		}
	}
});

const SUPPORTED_ESLINT_VERSION = '9';

function hasEslint(version: string | undefined): boolean {
	return !!version && version.startsWith(SUPPORTED_ESLINT_VERSION);
}
