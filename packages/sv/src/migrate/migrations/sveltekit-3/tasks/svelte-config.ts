import { svelteConfig } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'svelte-config',
	description: 'Migrate svelte.config.* to vite.config.*',
	run: ({ sv, cwd }) => {
		const configSource = svelteConfig.find(cwd);

		if (!configSource) return; // no config found
		if (configSource.kind === 'vite') return; // already migrated vite config

		const originalConfigObject = svelteConfig.read(cwd);
		if (!originalConfigObject) return;

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
	}
});
