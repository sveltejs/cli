import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import * as browser from '../browser.ts';
import * as root from '../index.ts';

const DIST = path.resolve(import.meta.dirname, '../../dist');
const NODE_BUILTIN_IMPORT = /^(?:import|export)[^'"]*from\s*["']node:[^"']+["']/gm;
const RELATIVE_IMPORT = /^(?:import|export)[^'"]*from\s*["']\.\/([^"']+)["']/gm;

test('root re-exports everything from the browser entry', () => {
	const missing = Object.keys(browser).filter((name) => !(name in root));
	expect(missing).toEqual([]);
});

// `pnpm build` runs before the tests in CI; skipped when running against a bare checkout.
describe.skipIf(!fs.existsSync(path.join(DIST, 'browser.mjs')))('built browser entry', () => {
	/** `browser.mjs` plus the chunks it pulls in. */
	function browserGraph(): string[] {
		const seen = new Set<string>();
		const queue = ['browser.mjs'];
		while (queue.length > 0) {
			const file = queue.pop()!;
			if (seen.has(file)) continue;
			seen.add(file);
			const content = fs.readFileSync(path.join(DIST, file), 'utf8');
			for (const [, dep] of content.matchAll(RELATIVE_IMPORT)) queue.push(dep);
		}
		return [...seen];
	}

	test('imports no node builtins', () => {
		const offenders = browserGraph().flatMap((file) => {
			const content = fs.readFileSync(path.join(DIST, file), 'utf8');
			return (content.match(NODE_BUILTIN_IMPORT) ?? []).map((hit) => `${file}: ${hit}`);
		});
		expect(offenders).toEqual([]);
	});

	// The published bundle inlines `yaml`'s browser build, which the source tests never see.
	test('bundled yaml keeps comments on round-trip', async () => {
		const { parse } = await import(path.join(DIST, 'browser.mjs'));
		const { data, generateCode } = parse.yaml('# keep me\na: 1\n');
		data.set('b', 2);
		expect(generateCode()).toBe('# keep me\na: 1\nb: 2\n');
	});
});
