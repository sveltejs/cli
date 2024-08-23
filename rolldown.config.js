import fs from 'node:fs';
import path from 'node:path';
import dts from 'unplugin-isolated-decl/rolldown';
import { execSync } from 'node:child_process';
import { isBuiltin } from 'node:module';

/** @import { Package } from "./packages/core/utils/common.js" */
/** @import { Plugin, RolldownOptions } from "rolldown" */
/** @typedef {Package & { peerDependencies: Record<string, string> }} PackageJson */

/**
 * @param {string} project
 * @returns {RolldownOptions}
 */
function getConfig(project) {
	const inputs = [`./packages/${project}/index.ts`];
	const outDir = `./packages/${project}/dist`;

	if (project === 'core') inputs.push(`./packages/${project}/internal.ts`);

	const projectRoot = path.resolve(path.join(outDir, '..'));
	fs.rmSync(outDir, { force: true, recursive: true });

	/** @type {PackageJson} */
	const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
	const externalDeps = getExternalDeps(pkg);

	const external = [
		// TODO: investigate why Rolldown is transforming dedent into malformed code
		/dedent/,
		/@svelte-cli\/core/
	];

	/** @type {Plugin[]} */
	const plugins = [
		{
			name: 'resolve-node-modules',
			resolveId(id) {
				const shouldExternal = externalDeps.has(id) || isBuiltin(id);
				if (shouldExternal) {
					return { id, external: true };
				}
			}
		}
	];

	if ('exports' in pkg) plugins.push(dts());

	if (project === 'create') {
		// This custom rolldown plugin is used to build the templates
		// and place them inside the dist folder after every rolldown build.
		// This is necessary because rolldown clears the output directory and
		// thus also removes the template files
		plugins.push({
			name: 'build-cli-templates',
			buildEnd() {
				console.log('building templates');
				execSync('node scripts/build-templates.js', { cwd: path.resolve('packages', 'create') });
				console.log('finished building templates');
			}
		});
	}

	const shim = ['core', 'ast-tooling'];
	return {
		input: inputs,
		platform: 'node',
		output: {
			dir: outDir,
			sourcemap: true,
			format: 'esm',
			// adds the shebang to the top of the bundle
			banner: [
				project === 'cli' && '#!/usr/bin/env node',
				shim.includes(project) && `import __node_module__ from 'node:module';`,
				shim.includes(project) && 'const require = __node_module__.createRequire(import.meta.url);'
			]
				.filter(Boolean)
				.join('\n')
		},

		external,
		plugins
	};
}

export default [
	getConfig('clack-core'),
	getConfig('clack-prompts'),
	getConfig('ast-tooling'),
	getConfig('ast-manipulation'),
	getConfig('config'),
	getConfig('create'),
	getConfig('core'),
	getConfig('cli')
];

/**
 * @param {PackageJson} pkg
 * @returns {Set<string>}
 */
function getExternalDeps(pkg) {
	return new Set([
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.peerDependencies ?? {})
	]);
}
