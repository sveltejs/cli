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
import { bundleCommunityAdders } from './scripts/bundle-community.js';

/** @import { Package } from "./packages/core/files/utils.js" */
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
		// This plugin is used to build the templates and place them inside the
		// `dist` folder after every rollup build. This is necessary as we're
		// clearing the output directory and thus also removes the template files
		buildCliTemplatesPlugin = {
			name: 'build-cli-templates',
			buildStart() {
				const templates = getFilePaths('packages', 'create', 'templates');
				const shared = getFilePaths('packages', 'create', 'shared');
				for (const file of shared.concat(templates)) {
					this.addWatchFile(file);
				}
			},
			async writeBundle() {
				console.log('building templates');
				const start = performance.now();
				await buildTemplates(path.resolve('packages', 'cli', 'dist'));
				const end = performance.now();
				console.log(`finished building templates: ${Math.round(end - start)}ms`);
			}
		};
	}

	/** @type {Plugin | undefined} */
	let buildCommunityAddersPlugin;
	if (project === 'core') {
		// This plugin bundles the JSON files found in `/community` and builds them into a single
		// TS module in `packages/adders/_config/community.ts`
		buildCommunityAddersPlugin = {
			name: 'build-community-adders-metadata',
			buildStart() {
				const files = getFilePaths('community');
				for (const file of files) {
					this.addWatchFile(file);
				}
			},
			async writeBundle() {
				console.log('building community adders');
				const start = performance.now();
				await bundleCommunityAdders();
				const end = performance.now();
				console.log(`finished building community adders: ${Math.round(end - start)}ms`);
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
			dynamicImportVars({ exclude: ['packages/cli/utils/fetch-packages.ts'] }),
			buildCliTemplatesPlugin,
			buildCommunityAddersPlugin
		]
	};
}

/** @type {RollupOptions[]} */
export default [
	getConfig('clack-core'),
	getConfig('clack-prompts'),
	getConfig('ast-tooling'),
	getConfig('ast-manipulation'),
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

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
function getFilePaths(...paths) {
	const dir = path.resolve(...paths);
	return fs.readdirSync(dir, { withFileTypes: true }).map((f) => path.join(f.parentPath, f.name));
}
