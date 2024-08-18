import fs from 'node:fs';
import path from 'node:path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import { execSync } from 'node:child_process';

/** @type {import("rollup").RollupOptions[]} */
const dtsConfigs = [];

/**
 * @param {string} project
 */
function getConfig(project) {
	const inputs = [];
	let outDir = '';

	inputs.push(`./packages/${project}/index.ts`);

	if (project == 'core') inputs.push(`./packages/${project}/internal.ts`);
	if (project == 'cli') inputs.push(`./packages/${project}/bin.ts`);

	outDir = `./packages/${project}/dist`;

	const projectRoot = path.resolve(path.join(outDir, '..'));
	fs.rmSync(outDir, { force: true, recursive: true });

	/** @type {import("./packages/core/utils/common.js").Package} */
	const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
	// any dep under `dependencies` is considered external
	const externalDeps = Object.keys(pkg.dependencies ?? {});

	// externalizes `sv` and `@svelte-cli/` deps while also bundling `/clack` and `/adders`
	const external = [/^(sv|@svelte-cli\/(?!clack|adders)\w*)/g, ...externalDeps];

	let buildCliTemplatesPlugin;
	if (project == 'cli') {
		// This custom rollup plugin is used to build the templates
		// and place them inside the dist folder after every rollup build.
		// This is necessary because rollup clears the output directory and
		// thus also removes the template files
		buildCliTemplatesPlugin = {
			name: 'build-cli-templates',
			writeBundle() {
				console.log('building templates');
				execSync('node scripts/build-templates.js', { cwd: path.resolve('packages', 'cli') });
				console.log('finished building templates');
			}
		};
	}

	/** @type {import("rollup").RollupOptions} */
	const config = {
		input: inputs,
		output: {
			dir: outDir,
			format: 'esm',
			sourcemap: true
		},
		external,
		plugins: [
			preserveShebangs(),
			esbuild({ tsconfig: 'tsconfig.json', sourceRoot: projectRoot }),
			nodeResolve({ preferBuiltins: true, rootDir: projectRoot }),
			commonjs(),
			json(),
			dynamicImportVars(),
			buildCliTemplatesPlugin
		]
	};

	// only generate dts files for libs
	if ('exports' in pkg) {
		// entry points need to have their own individual configs,
		// otherwise the `build` dir will generate unnecessary nested dirs
		// e.g. `packages/cli/build/packages/cli/index.d.ts` as opposed to: `packages/cli/build/index.d.ts`
		for (const input of inputs) {
			dtsConfigs.push({
				input,
				output: {
					dir: outDir
				},
				external,
				plugins: [dts()]
			});
		}
	}

	return config;
}

export default [
	getConfig('clack-core'),
	getConfig('clack-prompts'),
	getConfig('ast-tooling'),
	getConfig('ast-manipulation'),
	getConfig('config'),
	getConfig('core'),
	getConfig('cli'),
	...dtsConfigs
];
