import fs from 'node:fs';
import path from 'node:path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';
import dts from 'unplugin-isolated-decl/rollup';
import esbuild from 'rollup-plugin-esbuild';
import { buildTemplates } from '@svelte-cli/create/build';

/** @import { Package } from "./packages/core/utils/common.js" */
/** @import { Plugin, RollupOptions } from "rollup" */
/** @typedef {Package & { peerDependencies: Record<string, string> }} PackageJson */

/**
 * @param {string} project
 * @returns {RollupOptions}
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

	// always externalizes `@svelte-cli/core` and any deps that are `dependencies` or `peerDependencies`
	const external = [/@svelte-cli\/core\w*/g, ...externalDeps];

	/** @type {Plugin | undefined} */
	let buildCliTemplatesPlugin;
	if (project === 'create') {
		// This custom rollup plugin is used to build the templates
		// and place them inside the dist folder after every rollup build.
		// This is necessary because rollup clears the output directory and
		// thus also removes the template files
		buildCliTemplatesPlugin = {
			name: 'build-cli-templates',
			async buildEnd() {
				console.log('building templates');
				const start = performance.now();
				await buildTemplates(path.resolve('packages', 'core', 'dist'));
				const end = performance.now();
				console.log(`finished building templates: ${Math.round(end - start)}ms`);
			}
		};
	}

	return {
		input: inputs,
		output: {
			dir: outDir,
			format: 'esm',
			sourcemap: true
		},
		external,
		plugins: [
			preserveShebangs(),
			'exports' in pkg && dts(),
			esbuild({ tsconfig: 'tsconfig.json', sourceRoot: projectRoot }),
			nodeResolve({ preferBuiltins: true, rootDir: projectRoot }),
			commonjs(),
			json(),
			dynamicImportVars(),
			buildCliTemplatesPlugin
		]
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
