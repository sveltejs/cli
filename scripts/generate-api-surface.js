/**
 * Reads generated `.d.mts` files and writes compact `api-surface.md` snapshots per package.
 *
 * Strips region/source-map directives, non-deprecated block comments, import-only lines,
 * and excess blank lines. Blocks mentioning `@deprecated` are kept verbatim.
 *
 * @remarks
 * Run: `node scripts/generate-api-surface.js` — or via root `postbuild` after `pnpm build`.
 * Output is formatted with Prettier using the repo root `prettier.config.js` so it matches `pnpm format`.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/** Absolute path to the repo Prettier config (explicit so formatting does not depend on cwd). */
const PRETTIER_CONFIG = path.join(ROOT, 'prettier.config.js');

const packages = [
	{
		name: 'sv',
		dts: 'packages/sv/dist/src/index.d.mts',
		out: 'packages/sv/api-surface.md'
	},
	{
		name: 'sv (testing)',
		dts: 'packages/sv/dist/src/testing.d.mts',
		out: 'packages/sv/api-surface-testing.md'
	},
	{
		name: '@sveltejs/sv-utils',
		dts: 'packages/sv-utils/dist/index.d.mts',
		out: 'packages/sv-utils/api-surface.md'
	}
];

/**
 * Remove `//#region` / `//#endregion` lines emitted by the DTS bundler.
 * @param {string} source
 * @returns {string}
 */
function stripRegionDirectives(source) {
	return source
		.split('\n')
		.filter((line) => !/^\s*\/\/#(region|endregion)\b/.test(line))
		.join('\n');
}

/**
 * Remove `//# sourceMappingURL=...` lines from declaration emit.
 * @param {string} source
 * @returns {string}
 */
function stripSourceMappingUrl(source) {
	return source
		.split('\n')
		.filter((line) => !/^\s*\/\/#\s*sourceMappingURL=/.test(line))
		.join('\n');
}

/**
 * Remove slash-star-star block comments unless they contain `@deprecated` (full block kept).
 * @param {string} source
 * @returns {string}
 */
function stripJsDoc(source) {
	return source.replace(/\/\*\*[\s\S]*?\*\//g, (match) => {
		if (/@deprecated\b/.test(match)) {
			return match;
		}
		return '';
	});
}

/**
 * Drop top-level `import …` lines (types-only noise in the snapshot).
 * @param {string} source
 * @returns {string}
 */
function stripImportLines(source) {
	return source
		.split('\n')
		.filter((line) => !line.match(/^import\s/))
		.join('\n');
}

/**
 * Collapse three or more consecutive newlines to two.
 * @param {string} source
 * @returns {string}
 */
function collapseBlankLines(source) {
	return source.replace(/\n{3,}/g, '\n\n');
}

/**
 * Apply all cleaning steps to declaration text.
 * @param {string} source
 * @returns {string}
 */
function clean(source) {
	let result = stripRegionDirectives(source);
	result = stripSourceMappingUrl(result);
	result = stripJsDoc(result);
	result = stripImportLines(result);
	result = collapseBlankLines(result);
	return result.trim() + '\n';
}

/**
 * Format a file with repo Prettier options (plugins + overrides).
 * @param {string} absPath absolute path to the markdown file
 * @returns {Promise<void>}
 */
async function formatWithPrettier(absPath) {
	const raw = fs.readFileSync(absPath, 'utf8');
	const options =
		(await prettier.resolveConfig(absPath, {
			config: PRETTIER_CONFIG
		})) ?? {};
	const formatted = await prettier.format(raw, { ...options, filepath: absPath });
	fs.writeFileSync(absPath, formatted, 'utf8');
}

/**
 * Collect names marked `@deprecated` in chunk files imported by the entry .d.mts.
 * Returns a Set of exported names whose declarations carry `@deprecated`.
 * @param {string} entrySource
 * @param {string} entryDir
 * @returns {Set<string>}
 */
function collectDeprecatedFromChunks(entrySource, entryDir) {
	/** @type {Set<string>} */
	const deprecated = new Set();

	// match: import { A as Foo, B as Bar } from "../chunk.mjs";
	const importRe = /^import\s+\{([^}]+)\}\s+from\s+"([^"]+)"/gm;
	let m;
	while ((m = importRe.exec(entrySource))) {
		const specifiers = m[1];
		const chunkRel = m[2];
		const chunkPath = path.resolve(entryDir, chunkRel.replace(/\.mjs$/, '.d.mts'));
		if (!fs.existsSync(chunkPath)) continue;

		const chunkSrc = fs.readFileSync(chunkPath, 'utf8');

		// collect full type names marked @deprecated in the chunk
		const deprecatedNames = new Set();
		// Match /** @deprecated ... */ directly followed by a top-level type declaration
		// The [^{}]* ensures we don't cross type body boundaries
		const depRe = /\/\*\*\s*@deprecated[^{}]*?\*\/\s*(?:export\s+)?type\s+(\w+)/g;
		let dm;
		while ((dm = depRe.exec(chunkSrc))) {
			deprecatedNames.add(dm[1]);
		}

		// map import specifiers (alias as ExportedName) back to chunk names
		// entry: "d as ConditionDefinition" -> chunk exports "ConditionDefinition as d"
		// so we check if ExportedName is deprecated in the chunk
		for (const spec of specifiers.split(',')) {
			const parts = spec.trim().split(/\s+as\s+/);
			if (parts.length !== 2) continue;
			const exportedName = parts[1];
			if (deprecatedNames.has(exportedName)) {
				deprecated.add(exportedName);
			}
		}
	}
	return deprecated;
}

/**
 * Annotate `type Foo` entries in the export block with `/** @deprecated *\/` if
 * the underlying declaration was marked deprecated in a chunk file.
 * @param {string} cleaned
 * @param {Set<string>} deprecated
 * @returns {string}
 */
function annotateDeprecatedExports(cleaned, deprecated) {
	if (deprecated.size === 0) return cleaned;
	// match "type Name" inside export { ... } blocks
	return cleaned.replace(/\btype\s+(\w+)/g, (match, name) => {
		if (deprecated.has(name)) {
			return `/** @deprecated */ type ${name}`;
		}
		return match;
	});
}

/** @returns {Promise<number>} number of api-surface files written */
export async function generateApiSurface() {
	let generated = 0;
	for (const pkg of packages) {
		const dtsPath = path.resolve(ROOT, pkg.dts);
		if (!fs.existsSync(dtsPath)) {
			console.warn(`  skipped ${pkg.name} - ${pkg.dts} not found (run build first)`);
			continue;
		}

		const raw = fs.readFileSync(dtsPath, 'utf8');
		const deprecated = collectDeprecatedFromChunks(raw, path.dirname(dtsPath));
		let cleaned = clean(raw);
		cleaned = annotateDeprecatedExports(cleaned, deprecated);

		const header =
			`# ${pkg.name} - Public API Surface\n\n` +
			`<!-- auto-generated by scripts/generate-api-surface.js - do not edit -->\n\n` +
			'```ts\n';
		const footer = '```\n';

		const outPath = path.resolve(ROOT, pkg.out);
		fs.writeFileSync(outPath, header + cleaned + footer, 'utf8');
		await formatWithPrettier(outPath);
		generated++;
		console.log(`  ${pkg.name} -> ${pkg.out}`);
	}

	if (generated === 0) {
		console.warn('No .d.mts files found - run `pnpm build` first.');
		process.exit(1);
	}

	return generated;
}

const isMain =
	process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
	generateApiSurface().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
