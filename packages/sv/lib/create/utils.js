/** @import { Common } from './index.js' */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} dir
 * @returns {void}
 */
export function mkdirp(dir) {
	try {
		fs.mkdirSync(dir, { recursive: true });
	} catch (err) {
		/** @type {any} */
		const e = err;
		if (e.code === 'EEXIST') return;
		throw e;
	}
}

/**
 * @template T
 * @param {T} x
 * @returns {T}
 */
function identity(x) {
	return x;
}

/**
 * @param {string} contents
 * @param {Record<string, string>} kv
 * @returns {string}
 */
export function replace(contents, kv) {
	for (const [key, value] of Object.entries(kv)) {
		contents = contents.replaceAll(key, value);
	}
	return contents;
}

/**
 * @param {string} from
 * @param {string} to
 * @param {(basename: string) => string} [rename]
 * @param {Record<string, string>} [kv]
 * @returns {void}
 */
export function copy(from, to, rename = identity, kv = {}) {
	if (!fs.existsSync(from)) return;
	const stats = fs.statSync(from);

	if (stats.isDirectory()) {
		fs.readdirSync(from).forEach((file) => {
			copy(path.join(from, file), path.join(to, rename(file)), rename, kv);
		});
	} else {
		mkdirp(path.dirname(to));
		fs.writeFileSync(to, replace(fs.readFileSync(from, 'utf-8'), kv));
	}
}

/**
 * @param {string} path
 * @returns {string}
 */
export function dist(path) {
	// we need to make this check, because vitest is making the package root the cwd,
	// but executing the cli from the command line already makes the dist folder the cwd.
	const insideDistFolder = import.meta.url.includes('dist');

	return fileURLToPath(
		new URL(`./${!insideDistFolder ? 'dist/' : ''}${path}`, import.meta.url).href
	);
}

/**
 * @returns {Common['files']}
 */
export function getSharedFiles() {
	const shared = dist('shared.json');
	const { files } = /** @type {Common} */ (JSON.parse(fs.readFileSync(shared, 'utf-8')));
	return files;
}
