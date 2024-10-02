// @ts-check
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
import MagicString from 'magic-string';

/** @import { Package } from "./packages/core/files/utils.js" */
/** @import { Plugin, RollupOptions } from "rollup" */
/** @typedef {Package & { peerDependencies: Record<string, string> }} PackageJson */

/**
 * @param {string} project
 * @returns {RollupOptions}
 */
function getConfig(project) {
	const projectRoot = `./packages/${project}`;
	const outDir = `${projectRoot}/dist`;

	/** @type {RollupOptions["input"]} */
	let inputs;

	if (project === 'core') {
		inputs = {
			index: `${projectRoot}/index.ts`,
			internal: `${projectRoot}/internal.ts`,
			css: `${projectRoot}/tooling/css/index.ts`,
			html: `${projectRoot}/tooling/html/index.ts`,
			js: `${projectRoot}/tooling/js/index.ts`
		};
	} else if (project === 'cli') {
		inputs = [`${projectRoot}/index.ts`, `${projectRoot}/bin.ts`];
	} else {
		inputs = [`${projectRoot}/index.ts`];
	}

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
	let communityAdderIdsPlugin;
	if (project === 'cli') {
		// Evaluates the ids of available community adders at build time
		communityAdderIdsPlugin = {
			name: 'evaluate-community-adder-ids',
			transform(code, id) {
				if (id.endsWith(`_config${path.sep}community.ts`)) {
					const ms = new MagicString(code, { filename: id });
					const start = code.indexOf('export const communityAdderIds');
					const end = code.indexOf(';', start);
					const ids = fs.readdirSync('community-adders').map((p) => path.parse(p).name);
					const generated = `export const communityAdderIds = ${JSON.stringify(ids)};`;
					ms.overwrite(start, end, generated);
					return {
						code: ms.toString(),
						map: ms.generateMap()
					};
				}
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
			'exports' in pkg && dts({ include: project === 'cli' ? [inputs[0]] : undefined }),
			esbuild(),
			nodeResolve({ preferBuiltins: true, rootDir: projectRoot }),
			commonjs(),
			json(),
			dynamicImportVars({
				// since we're relying on the usage of standard dynamic imports for community adders, we need to
				// prevent this plugin from transforming these cases
				exclude: ['packages/cli/utils/fetch-packages.ts']
			}),
			buildCliTemplatesPlugin,
			communityAdderIdsPlugin
		]
	};
}

/** @type {RollupOptions[]} */
export default [
	getConfig('clack-core'),
	getConfig('clack-prompts'),
	getConfig('ast-tooling'),
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
