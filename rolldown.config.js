// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import dts from 'unplugin-isolated-decl/rolldown';
import { buildTemplates } from '@sveltejs/create/build';
import MagicString from 'magic-string';

/** @import { Package } from "./packages/cli/commands/add/utils.ts" */
/** @import { Plugin, RolldownOptions } from "rolldown" */
/** @typedef {Package & { peerDependencies: Record<string, string> }} PackageJson */

/**
 * @param {string} project
 * @returns {RolldownOptions}
 */
function getConfig(project) {
	const projectRoot = `./packages/${project}`;
	const outDir = `${projectRoot}/dist`;

	/** @type {RolldownOptions["input"]} */
	let inputs;

	if (project === 'core') {
		inputs = {
			index: `${projectRoot}/index.ts`,
			css: `${projectRoot}/tooling/css/index.ts`,
			html: `${projectRoot}/tooling/html/index.ts`,
			js: `${projectRoot}/tooling/js/index.ts`,
			parsers: `${projectRoot}/tooling/parsers.ts`
		};
	} else if (project === 'cli') {
		inputs = [
			`${projectRoot}/lib/index.ts`,
			`${projectRoot}/lib/testing.ts`,
			`${projectRoot}/bin.ts`
		];
	} else if (project === 'create') {
		inputs = [`${projectRoot}/index.ts`, `${projectRoot}/playground.ts`];
	} else {
		inputs = [`${projectRoot}/index.ts`];
	}

	fs.rmSync(outDir, { force: true, recursive: true });

	/** @type {PackageJson} */
	const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
	const externalDeps = getExternalDeps(pkg);

	// always externalizes `@sveltejs/cli-core` and any deps that are `dependencies` or `peerDependencies`
	const external = [...externalDeps];

	/** @type {Plugin | undefined} */
	let buildCliTemplatesPlugin;
	if (project === 'create') {
		// This plugin is used to build the templates and place them inside the
		// `dist` folder after every rolldown build. This is necessary as we're
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
				await buildTemplates(path.resolve('packages', 'create', 'dist'));
				const end = performance.now();
				console.log(`finished building templates: ${Math.round(end - start)}ms`);
			}
		};
	}

	/** @type {Plugin | undefined} */
	let communityAddonIdsPlugin;
	if (project === 'cli') {
		// Evaluates the ids of available community addons at build time
		communityAddonIdsPlugin = {
			name: 'evaluate-community-addon-ids',
			transform(code, id) {
				if (id.endsWith(`_config${path.sep}community.ts`)) {
					const ms = new MagicString(code, { filename: id });
					const start = code.indexOf('export const communityAddonIds');
					const end = code.indexOf(';', start);
					const ids = fs.readdirSync('community-addons').map((p) => path.parse(p).name);
					const generated = `export const communityAddonIds = ${JSON.stringify(ids)};`;
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
		platform: 'node',
		output: {
			dir: outDir,
			format: 'esm',
			sourcemap: !process.env.CI
		},
		external,
		plugins: [
			'exports' in pkg &&
				dts({
					include: project === 'cli' ? [`${projectRoot}/lib/*`] : undefined,
					inputBase: project === 'cli' ? path.resolve(projectRoot, 'lib') : undefined
				}),
			buildCliTemplatesPlugin,
			communityAddonIdsPlugin
		]
	};
}

/** @type {RolldownOptions[]} */
export default [getConfig('create'), getConfig('core'), getConfig('cli')];

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
