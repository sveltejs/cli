import { svelteConfig, transforms } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import { defineMigrationTask } from '../../../index.ts';

// matches `svelte.config`, optionally with a (m/c)js/ts extension, at the end of an import source
const SVELTE_CONFIG_IMPORT = /(^|\/)svelte\.config(\.[mc]?[jt]s)?$/;

export default defineMigrationTask({
	id: 'svelte-config',
	description: 'Migrate svelte.config.* to vite.config.*',
	run: ({ sv, cwd }) => {
		const configSource = svelteConfig.find(cwd);

		if (!configSource) return; // no config found
		if (configSource.kind === 'vite') return; // already migrated vite config

		const originalConfigObject = svelteConfig.read(cwd);
		if (!originalConfigObject) return;

		// delete the original config file, so that the we will use the vite config afterwards
		fs.unlinkSync(path.join(cwd, configSource.path));

		svelteConfig.edit({ sv, cwd }, ({ ast, override }) => {
			// detect original imports and preserve them in the new config
			const originalImports = originalConfigObject.ast.body.filter(
				(node) => node.type === 'ImportDeclaration'
			);
			ast.body.unshift(...originalImports);

			// kit-level options are flattened into the root of the vite config, so merge the properties
			// and then move the properties into the new config object, skipping the unflattened `kit` wrapper
			const newConfigProperties = [
				...originalConfigObject.config.properties,
				...originalConfigObject.kit.properties
			];
			const keyedConfig: Record<string, any> = [];

			for (const prop of newConfigProperties) {
				if (prop.type !== 'Property') continue;
				if (prop.key.type !== 'Identifier') continue;
				if (prop.key.name === 'kit') continue;

				keyedConfig[prop.key.name] = prop.value;
			}

			override(keyedConfig);
		});

		// other files may import from the now-deleted svelte.config (e.g. eslint.config.js passing
		// `svelteConfig` to the parser). There's no importable config once it lives in vite.config,
		// so flag every such import for manual handling.
		sv.files(
			{
				include: '**/*.{js,ts,mjs,mts,cjs,cts}',
				where: (content) => content.includes('svelte.config')
			},
			(content, filePath) => {
				// eslint no longer needs the config: svelte-eslint-parser falls back to its defaults.
				// Anything else should read the config at runtime via `@sveltejs/load-config`.
				const message = /(^|\/)eslint\.config\.[mc]?[jt]s$/.test(filePath)
					? ' @migration-task svelteConfig should not be needed anymore, see https://github.com/sveltejs/eslint-plugin-svelte/issues/1550'
					: " @migration-task svelte.config was removed; switch to `import { loadConfig } from '@sveltejs/load-config'` to read your config";

				return transforms.script(({ ast, comments, js }) => {
					const found = js.imports.findAll(ast, { from: SVELTE_CONFIG_IMPORT });
					if (found.length === 0) return false;
					for (const imp of found) {
						comments.add(imp.node, { type: 'Line', value: message });
					}
				})(content);
			}
		);
	}
});
