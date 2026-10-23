// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import parser from 'gitignore-parser';
import { format } from 'oxfmt';
import { transform } from 'sucrase';
import oxfmtConfig from '../../../../../oxfmt.config.ts';
import { mkdirp } from './build-templates.js';

/** @import { File, LanguageType } from '../index.ts' */
/** @import { PackageJSON } from '../../core/common.ts' */

const pkgRoot = path.resolve(import.meta.dirname, '..');

/** @param {string} content */
export async function convert_typescript(content) {
	let { code } = transform(content, {
		transforms: ['typescript'],
		disableESTransforms: true
	});

	// sucrase leaves invalid class fields intact
	code = code.replace(/^\s*[a-z]+;$/gm, '');

	// Replace "local import" that ends with ".ts" to ".js"
	code = code.replace(/import (.+?) from ['"](.+?)\.ts['"]/g, 'import $1 from "$2.js"');

	const result = await format('file.js', code, oxfmtConfig);

	return result.code;
}

/** @param {string} content */
export function strip_jsdoc(content) {
	return content
		.replace(/ \/\*\*\*\//g, '')
		.replace(
			/\/\*\*([\s\S]+?)(@[\s\S]+?)?\*\/([\s\n]+)/g,
			(match, description, tags, whitespace) => {
				if (/^\s+(\*\s*)?$/.test(description)) {
					return '';
				}

				return `/**${description.replace(/\* $/, '')}*/${whitespace}`;
			}
		);
}

/**
 * @param {string} string
 * @param {RegExp} regexp
 * @param {(m: any, attrs: string, typescript: string) => Promise<string>} replacer
 */
async function replace_async(string, regexp, replacer) {
	const replacements = await Promise.all(
		// @ts-ignore
		Array.from(string.matchAll(regexp), (match) => replacer(...match))
	);
	let i = 0;
	return string.replace(regexp, () => replacements[i++]);
}

/**
 * Derive the per-language `package.json` variants from the template's
 * TypeScript-complete `package.json`. `checkjs` only rewrites the tsconfig
 * path in the check scripts; `none` drops typechecking entirely.
 * @param {PackageJSON} pkg
 * @param {string} template
 * @returns {Record<LanguageType, PackageJSON>}
 */
function package_variants(pkg, template) {
	const typescript = pkg;
	const checkjs = structuredClone(pkg);
	const none = structuredClone(pkg);

	for (const key of ['check', 'check:watch']) {
		if (typeof checkjs.scripts?.[key] === 'string') {
			checkjs.scripts[key] = checkjs.scripts[key].replaceAll('./tsconfig.json', './jsconfig.json');
		}
	}

	if (none.scripts) {
		delete none.scripts.check;
		delete none.scripts['check:watch'];
	}

	if (none.devDependencies) {
		delete none.devDependencies['svelte-check'];

		// `typescript` is only a typechecking dependency, except for the
		// library template where packaging (`svelte-package`) needs it
		if (template !== 'library') delete none.devDependencies.typescript;
	}

	return { typescript, checkjs, none };
}

/**
 * @param {string} dist
 * @param {Set<string>} shared
 */
export async function generate_kit_template(dist, shared) {
	const templates = fs.readdirSync(path.resolve(pkgRoot, 'templates'));

	for (const template of templates) {
		if (template[0] === '.') continue;

		const dir = path.join(dist, 'templates', template);
		const assets = path.join(dir, 'assets');
		mkdirp(assets);

		const cwd = path.resolve(pkgRoot, 'templates', template);

		const gitignore_file = path.join(cwd, '.gitignore');
		if (!fs.existsSync(gitignore_file)) {
			throw new Error(`"${template}" template must have a .gitignore file`);
		}

		const gitignore = parser.compile(fs.readFileSync(gitignore_file, 'utf-8'));

		const meta_file = path.join(cwd, '.meta.json');
		if (!fs.existsSync(meta_file)) throw new Error('Template must have a .meta.json file');

		/** @type {Record<LanguageType, File[]>} */
		const types = {
			typescript: [],
			checkjs: [],
			none: []
		};

		const files = fs
			.readdirSync(cwd, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map(({ parentPath, name }) => path.join(path.relative(cwd, parentPath), name))
			.sort();
		for (const name of files) {
			if (name === 'package.json') {
				const packagesDir = path.resolve(pkgRoot, '..', '..', '..');
				const getVersion = (/** @type {string} */ pkgDir) => {
					const pkgPath = path.join(packagesDir, pkgDir, 'package.json');
					return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
				};
				const replaceWorkspace = (
					/** @type {string} */ str,
					/** @type {string} */ key,
					/** @type {string} */ version
				) => {
					return str.replaceAll(`"${key}": "workspace:*"`, `"${key}": "^${version}"`);
				};

				let contents = fs.readFileSync(path.join(cwd, name), 'utf8');
				contents = replaceWorkspace(contents, 'sv', getVersion('sv'));
				contents = replaceWorkspace(contents, '@sveltejs/sv-utils', getVersion('sv-utils'));

				const variants = package_variants(JSON.parse(contents), template);
				fs.writeFileSync(path.join(dir, 'package.json'), contents);
				for (const lang of /** @type {LanguageType[]} */ (['typescript', 'checkjs', 'none'])) {
					types[lang].push({ name, contents: JSON.stringify(variants[lang], null, '\t') + '\n' });
				}
				continue;
			}

			if (name === 'tsconfig.json' || name === 'jsconfig.json') {
				const contents = fs.readFileSync(path.join(cwd, name), 'utf8');

				types.typescript.push({ name: 'tsconfig.json', contents });
				types.checkjs.push({ name: 'jsconfig.json', contents });
				types.none.push({ name: 'jsconfig.json', contents });

				continue;
			}

			// ignore files that are written conditionally
			if (shared.has(name)) continue;

			// ignore the .gitignore contents and anything gitignores
			if (!gitignore.accepts(name) || name === '.ignore') continue;

			if (/\.(ts|svelte)$/.test(name)) {
				const contents = fs.readFileSync(path.join(cwd, name), 'utf8');

				if (name.endsWith('.d.ts')) {
					if (name.endsWith('app.d.ts')) types.checkjs.push({ name, contents });
					types.typescript.push({ name, contents });
				} else if (name.endsWith('.ts')) {
					const js = await convert_typescript(contents);

					types.typescript.push({
						name,
						contents: strip_jsdoc(contents)
					});

					types.checkjs.push({
						name: name.replace(/\.ts$/, '.js'),
						contents: js
					});

					types.none.push({
						name: name.replace(/\.ts$/, '.js'),
						contents: strip_jsdoc(js)
					});
				} else {
					// we jump through some hoops, rather than just using svelte.preprocess,
					// so that the output preserves the original formatting to the extent
					// possible (e.g. preserving double line breaks). Sucrase is the best
					// tool for the job because it just removes the types; Prettier then
					// tidies up the end result
					const js_contents = await replace_async(
						contents,
						/<script([^>]+)>([\s\S]+?)<\/script>/g,
						async (
							/** @type {any} */ m,
							/** @type {string} */ attrs,
							/** @type {string} */ typescript
						) => {
							// Sucrase assumes 'unused' imports (which _are_ used, but only
							// in the markup) are type imports, and strips them. This step
							// prevents it from drawing that conclusion
							const imports = [];
							const import_pattern = /import (.+?) from/g;
							let import_match;
							while ((import_match = import_pattern.exec(typescript))) {
								const word_pattern = /[a-z_$][a-z0-9_$]*/gi;
								let word_match;
								// @ts-ignore
								while ((word_match = word_pattern.exec(import_match[1]))) {
									imports.push(word_match[0]);
								}
							}

							const suffix = `\n${imports.join(',')}`;

							const transformed = transform(typescript + suffix, {
								transforms: ['typescript'],
								disableESTransforms: true
							}).code.slice(0, -suffix.length);

							const contents = (await format('file.js', transformed, oxfmtConfig)).code
								.trim()
								.replace(/^(.)/gm, '\t$1');

							return `<script${attrs.replace(' lang="ts"', '')}>\n${contents}\n</script>`;
						}
					);

					types.typescript.push({
						name,
						contents: strip_jsdoc(contents)
					});

					types.checkjs.push({
						name,
						contents: js_contents
					});

					types.none.push({
						name,
						contents: strip_jsdoc(js_contents)
					});
				}
			} else {
				const dest = path.join(assets, name.replace(/^\./, 'DOT-'));
				mkdirp(path.dirname(dest));
				fs.copyFileSync(path.join(cwd, name), dest);
			}
		}

		fs.copyFileSync(meta_file, path.join(dir, 'meta.json'));
		fs.writeFileSync(
			path.join(dir, 'files.types=typescript.json'),
			JSON.stringify(types.typescript, null, '\t')
		);
		fs.writeFileSync(
			path.join(dir, 'files.types=checkjs.json'),
			JSON.stringify(types.checkjs, null, '\t')
		);
		fs.writeFileSync(
			path.join(dir, 'files.types=none.json'),
			JSON.stringify(types.none, null, '\t')
		);
	}
}
