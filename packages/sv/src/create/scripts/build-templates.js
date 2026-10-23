// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { strip_typescript, generate_kit_template, strip_jsdoc } from './generate-kit-template.js';
import { generate_vite_template } from './generate-vite-template.js';

const pkgRoot = path.resolve(import.meta.dirname, '..');

/**
 * @param {string} dist
 */
export async function generate_shared(dist) {
	const cwd = path.resolve(pkgRoot, 'shared');

	/** @type {Set<string>} */
	const shared = new Set();

	/** @type {Array<{ name: string, include: string[], exclude: string[], contents: string }>} */
	const files = [];

	const globbed = fs
		.readdirSync(cwd, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map(({ parentPath, name }) => path.join(path.relative(cwd, parentPath), name))
		.sort();
	for (const file of globbed) {
		const contents = fs.readFileSync(path.join(cwd, file), 'utf8');

		/** @type {string[]} */
		const include = [];

		/** @type {string[]} */
		const exclude = [];

		let name = file;

		if (file.startsWith('+') || file.startsWith('-')) {
			const [conditions, ...rest] = file.split(path.sep);

			const pattern = /([+-])([a-z0-9]+)/g;
			let match;
			// @ts-ignore
			while ((match = pattern.exec(conditions))) {
				const set = match[1] === '+' ? include : exclude;
				// @ts-ignore
				set.push(match[2]);
			}

			name = rest.join('/');
		}

		if (name.endsWith('.ts') && !include.includes('typescript')) {
			// file includes types in TypeScript and JSDoc —
			// create .js file, with and without JSDoc
			const js = await strip_typescript(contents);
			const js_name = name.replace(/\.ts$/, '.js');

			// typescript
			files.push({
				name,
				include: [...include, 'typescript'],
				exclude,
				contents: strip_jsdoc(contents)
			});

			// checkjs
			files.push({
				name: js_name,
				include: [...include, 'checkjs'],
				exclude,
				contents: js
			});

			// no typechecking
			files.push({
				name: js_name,
				include,
				exclude: [...exclude, 'typescript', 'checkjs'],
				contents: strip_jsdoc(js)
			});

			shared.add(name);
			shared.add(js_name);
		} else {
			shared.add(name);
			files.push({ name, include, exclude, contents });
		}
	}

	files.sort((a, b) => a.include.length + a.exclude.length - (b.include.length + b.exclude.length));

	fs.writeFileSync(path.join(dist, 'shared.json'), JSON.stringify({ files }, null, '\t'));

	shared.delete('package.json');
	return shared;
}

/** @param {string} dir */
export function mkdirp(dir) {
	try {
		fs.mkdirSync(dir, { recursive: true });
	} catch (e) {
		if (/** @type {any} */ (e).code === 'EEXIST') return;
		throw e;
	}
}

/**
 * @param {string} dist
 */
export async function buildTemplates(dist) {
	mkdirp(dist);

	const shared = await generate_shared(dist);
	await generate_kit_template(dist, shared);
	generate_vite_template(dist);
}
