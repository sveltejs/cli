import fs from 'node:fs';
import path from 'node:path';
import { mkdirp, copy, dist, getSharedFiles, replace } from './utils.js';
import { commonFilePaths } from '../cli/add/utils.js';
import { sanitizeName } from '../coreInternal.js';

/**
 * @typedef {(typeof templateTypes)[number]} TemplateType
 */

/**
 * @typedef {(typeof languageTypes)[number]} LanguageType
 */

/** @type {readonly ['minimal', 'demo', 'library', 'addon']} */
const templateTypes = ['minimal', 'demo', 'library', 'addon'];
/** @type {readonly ['typescript', 'checkjs', 'none']} */
const languageTypes = ['typescript', 'checkjs', 'none'];

/**
 * @typedef {{
 *   name: string;
 *   template: TemplateType;
 *   types: LanguageType;
 * }} Options
 */

/**
 * @typedef {{
 *   name: string;
 *   contents: string;
 * }} File
 */

/**
 * @typedef {TemplateType | LanguageType | 'playground' | 'mcp'} Condition
 */

/**
 * @typedef {{
 *   files: Array<{
 *     name: string;
 *     include: Condition[];
 *     exclude: Condition[];
 *     contents: string;
 *   }>;
 * }} Common
 */

/**
 * @param {string} cwd
 * @param {Options} options
 * @returns {void}
 */
export function create(cwd, options) {
	mkdirp(cwd);

	write_template_files(options.template, options.types, options.name, cwd);
	write_common_files(cwd, options, options.name);

	// Files that are not relevant for addon projects
	if (options.template === 'addon') {
		fs.rmSync(path.join(cwd, 'svelte.config.js'));
		fs.rmSync(path.join(cwd, 'vite.config.js'));
	}
}

/**
 * @typedef {{ name: TemplateType; title: string; description: string }} TemplateMetadata
 */

/** @type {TemplateMetadata[]} */
export const templates = templateTypes.map((dir) => {
	const meta_file = dist(`templates/${dir}/meta.json`);
	const { title, description } = JSON.parse(fs.readFileSync(meta_file, 'utf8'));

	return {
		name: dir,
		title,
		description
	};
});

/**
 * @param {string} name
 */
const kv = (name) => {
	const protocolName = name.startsWith('@') ? name.split('/')[0] : name;
	return {
		'~SV-PROTOCOL-NAME-TODO~': protocolName,
		'~SV-NAME-TODO~': name
	};
};

/**
 * @param {string} template
 * @param {LanguageType} types
 * @param {string} name
 * @param {string} cwd
 */
function write_template_files(template, types, name, cwd) {
	const dir = dist(`templates/${template}`);
	copy(
		`${dir}/assets`,
		cwd,
		/** @param {string} name */ (name) => name.replace('DOT-', '.'),
		kv(name)
	);
	copy(`${dir}/package.json`, `${cwd}/package.json`, undefined, kv(name));

	const manifest = `${dir}/files.types=${types}.json`;
	const files = /** @type {File[]} */ (JSON.parse(fs.readFileSync(manifest, 'utf-8')));

	files.forEach((file) => {
		const dest = path.join(cwd, file.name);
		mkdirp(path.dirname(dest));
		fs.writeFileSync(dest, replace(file.contents, kv(name)));
	});
}

/**
 * @param {string} cwd
 * @param {Options} options
 * @param {string} name
 */
function write_common_files(cwd, options, name) {
	const files = getSharedFiles();

	const pkg_file = path.join(cwd, commonFilePaths.packageJson);
	const pkg = /** @type {any} */ (JSON.parse(fs.readFileSync(pkg_file, 'utf-8')));

	sort_files(files).forEach((file) => {
		const include = file.include.every((condition) => matches_condition(condition, options));
		const exclude = file.exclude.some((condition) => matches_condition(condition, options));

		if (exclude || !include) return;

		if (file.name === commonFilePaths.packageJson) {
			const new_pkg = JSON.parse(file.contents);
			merge(pkg, new_pkg);
		} else {
			const dest = path.join(cwd, file.name);
			mkdirp(path.dirname(dest));
			fs.writeFileSync(dest, replace(file.contents, kv(name)));
		}
	});

	pkg.dependencies = sort_keys(pkg.dependencies);
	pkg.devDependencies = sort_keys(pkg.devDependencies);
	pkg.name = sanitizeName(name, 'package');

	fs.writeFileSync(pkg_file, JSON.stringify(pkg, null, '\t') + '\n');
}

/**
 * @param {Condition} condition
 * @param {Options} options
 * @returns {boolean}
 */
function matches_condition(condition, options) {
	if (templateTypes.includes(/** @type {TemplateType} */ (condition))) {
		return options.template === condition;
	}
	if (languageTypes.includes(/** @type {LanguageType} */ (condition))) {
		return options.types === condition;
	}
	return Boolean(options[/** @type {never} */ (condition)]);
}

/**
 * @param {any} target
 * @param {any} source
 */
function merge(target, source) {
	for (const key in source) {
		if (key in target) {
			const target_value = target[key];
			const source_value = source[key];

			if (
				typeof source_value !== typeof target_value ||
				Array.isArray(source_value) !== Array.isArray(target_value)
			) {
				throw new Error('Mismatched values');
			}

			if (typeof source_value === 'object') {
				merge(target_value, source_value);
			} else {
				target[key] = source_value;
			}
		} else {
			target[key] = source[key];
		}
	}
}

/**
 * @param {Record<string, any>} obj
 * @returns {Record<string, any> | undefined}
 */
function sort_keys(obj) {
	if (!obj) return;

	/** @type {Record<string, any>} */
	const sorted = {};
	Object.keys(obj)
		.sort()
		.forEach((key) => {
			sorted[key] = obj[key];
		});

	return sorted;
}

/**
 * Sort files so that those which apply more generically come first so they
 * can be overwritten by files for more precise cases later.
 * @param {Common['files']} files
 * @returns {Common['files']}
 */
function sort_files(files) {
	return files.sort((f1, f2) => {
		const f1_more_generic =
			f1.include.every((include) => f2.include.includes(include)) &&
			f1.exclude.every((exclude) => f2.exclude.includes(exclude));
		const f2_more_generic =
			f2.include.every((include) => f1.include.includes(include)) &&
			f2.exclude.every((exclude) => f1.exclude.includes(exclude));
		const same = f1_more_generic && f2_more_generic;
		const different = !f1_more_generic && !f2_more_generic;
		return same || different ? 0 : f1_more_generic ? -1 : 1;
	});
}
