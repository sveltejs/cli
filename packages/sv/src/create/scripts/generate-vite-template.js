// @ts-check
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdirp } from './build-templates.js';

/** @import { File, LanguageType } from '../index.ts' */

const require = createRequire(import.meta.url);
const createVitePath = path.dirname(require.resolve('create-vite/package.json'));

/**
 * Generates the 'svelte' template (vite-only, no SvelteKit) from create-vite bundled templates.
 * This template is internal-only and not shown in CLI prompts.
 * @param {string} dist
 */
export function generate_vite_template(dist) {
	const dir = path.join(dist, 'templates', 'svelte');
	const assets = path.join(dir, 'assets');
	mkdirp(assets);

	/** @type {Record<LanguageType, File[]>} */
	const types = {
		typescript: [],
		checkjs: [], // not used for vite template
		none: []
	};

	// Process both JS and TS variants
	const variants = /** @type {const} */ ([
		{ src: 'template-svelte', lang: /** @type {LanguageType} */ ('none') },
		{ src: 'template-svelte-ts', lang: /** @type {LanguageType} */ ('typescript') }
	]);

	for (const { src, lang } of variants) {
		const srcDir = path.join(createVitePath, src);
		const files = fs
			.readdirSync(srcDir, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map(({ parentPath, name }) => path.join(path.relative(srcDir, parentPath), name))
			.sort();

		for (const name of files) {
			const srcPath = path.join(srcDir, name);
			const contents = fs.readFileSync(srcPath, 'utf8');

			// Handle _gitignore -> .gitignore rename (asset file)
			if (name === '_gitignore' && lang === 'none') {
				const dest = path.join(assets, 'DOT-gitignore');
				fs.copyFileSync(srcPath, dest);
				continue;
			}
			if (name === '_gitignore') continue;

			// Binary/asset files go to assets folder (only process once for 'none' variant)
			if (lang === 'none' && !/\.(js|ts|svelte|json|html|css|md)$/i.test(name)) {
				const dest = path.join(assets, name.replace(/^\./, 'DOT-'));
				mkdirp(path.dirname(dest));
				fs.copyFileSync(srcPath, dest);
				continue;
			}

			// Text files go to files.types=*.json
			if (/\.(js|ts|svelte|json|html|css)$/i.test(name)) {
				// Skip jsconfig.json for TS variant, skip tsconfig.json for JS variant
				if (name === 'jsconfig.json' && lang === 'typescript') continue;
				if (name === 'tsconfig.json' && lang === 'none') continue;

				types[lang].push({ name, contents });
			}
		}
	}

	// Write meta.json (internal template, minimal metadata)
	fs.writeFileSync(
		path.join(dir, 'meta.json'),
		JSON.stringify(
			{ title: 'Svelte', description: 'Vite + Svelte template (internal)' },
			null,
			'\t'
		)
	);

	// Write files for each language type
	fs.writeFileSync(
		path.join(dir, 'files.types=typescript.json'),
		JSON.stringify(types.typescript, null, '\t')
	);
	fs.writeFileSync(
		path.join(dir, 'files.types=checkjs.json'),
		JSON.stringify([], null, '\t') // empty, not supported for vite template
	);
	fs.writeFileSync(path.join(dir, 'files.types=none.json'), JSON.stringify(types.none, null, '\t'));
}
