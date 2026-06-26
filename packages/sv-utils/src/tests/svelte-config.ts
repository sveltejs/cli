import { describe, expect, test } from 'vitest';
import {
	_editConfigContent,
	svelteConfig,
	type SvelteConfEdit,
	type SvelteConfigKind
} from '../svelte-config.ts';

/** An in-memory reader over a plain file map - no filesystem involved. */
const reader = (files: Record<string, string>) => (path: string) => files[path] ?? null;

/** Runs an edit against `content` for a given location kind, returning the serialized result. */
const applyEdit = (content: string, kind: SvelteConfigKind, edit: SvelteConfEdit) =>
	_editConfigContent(
		content,
		{ path: kind === 'vite' ? 'vite.config.js' : 'svelte.config.js', kind },
		edit
	);

const addAlias: SvelteConfEdit = ({ override, js }) =>
	override({ alias: js.object.create({ $lib: js.common.createLiteral('./src/lib') }) });
const addExtension: SvelteConfEdit = ({ property, js }) =>
	js.array.append(property('extensions', { fallback: js.array.create() }), '.svx');

const VITE_CONFIG = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
`;

const VITE_CONFIG_TS = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter() })]
}) satisfies UserConfig;
`;

const VITE_CONFIG_ALIASED = `import { sveltekit as youhou } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
	plugins: [youhou({ /** stuff */ })]
}));
`;

// a stray sveltekit() in dead code BEFORE the real one in the export's plugins array
const VITE_CONFIG_TWO_CALLS = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const unused = { plugins: [sveltekit()] };

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter() })]
});
`;

const SVELTE_CONFIG = `import adapter from '@sveltejs/adapter-auto';

const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
`;

const SVELTE_CONFIG_TS = `export default {
	kit: {}
};
`;

const SVELTE_CONFIG_SATISFIES = `import type { Config } from '@sveltejs/kit';

export default {
	kit: {}
} satisfies Config;
`;

const SVELTE_CONFIG_AS = `export default { kit: {} } as Config;`;

const SVELTE_CONFIG_BAD = `export default function () {};`;

describe('svelteConfig.find', () => {
	test('detects config in vite.config.js via sveltekit() call', () => {
		expect(svelteConfig.find(reader({ 'vite.config.js': VITE_CONFIG }))).toEqual({
			path: 'vite.config.js',
			kind: 'vite'
		});
	});

	test('detects config in svelte.config.js via default export', () => {
		expect(svelteConfig.find(reader({ 'svelte.config.js': SVELTE_CONFIG }))).toEqual({
			path: 'svelte.config.js',
			kind: 'svelte'
		});
	});

	test('detects the .ts variants', () => {
		expect(svelteConfig.find(reader({ 'svelte.config.ts': SVELTE_CONFIG_TS }))).toEqual({
			path: 'svelte.config.ts',
			kind: 'svelte'
		});
		expect(svelteConfig.find(reader({ 'vite.config.ts': VITE_CONFIG_TS }))).toEqual({
			path: 'vite.config.ts',
			kind: 'vite'
		});
	});

	test('prefers svelte.config even when a bare sveltekit() vite config is present', () => {
		const read = reader({ 'svelte.config.js': SVELTE_CONFIG, 'vite.config.js': VITE_CONFIG });
		expect(svelteConfig.find(read)?.kind).toBe('svelte');
	});

	test('detects an aliased sveltekit() inside a defineConfig arrow function', () => {
		expect(svelteConfig.find(reader({ 'vite.config.js': VITE_CONFIG_ALIASED }))).toEqual({
			path: 'vite.config.js',
			kind: 'vite'
		});
	});

	test('returns null when no config is present', () => {
		expect(svelteConfig.find(reader({ 'package.json': '{}' }))).toBe(null);
	});
});

describe('svelteConfig.read', () => {
	test('returns the flattened object for a vite config (config === kit)', () => {
		const result = svelteConfig.read(reader({ 'vite.config.js': VITE_CONFIG }));
		expect(result?.location).toEqual({ path: 'vite.config.js', kind: 'vite' });
		expect(result?.config).toBe(result?.kit);
	});

	test('returns distinct config/kit for a svelte config', () => {
		const result = svelteConfig.read(reader({ 'svelte.config.js': SVELTE_CONFIG }));
		expect(result?.location.kind).toBe('svelte');
		expect(result?.config).not.toBe(result?.kit);
	});

	test('returns null when no config is present', () => {
		expect(svelteConfig.read(reader({ 'package.json': '{}' }))).toBe(null);
	});
});

describe('svelteConfig.edit routing', () => {
	test('routes svelte-level options to the config root (vite location)', () => {
		const result = applyEdit(VITE_CONFIG, 'vite', addExtension);
		expect(result).toContain('sveltekit({');
		expect(result).toContain("extensions: ['.svx']");
	});

	test('flattens kit-level options onto the sveltekit() argument (vite location)', () => {
		const result = applyEdit(VITE_CONFIG, 'vite', addAlias);
		expect(result).toContain('alias:');
		expect(result).not.toContain('kit:');
	});

	test('nests kit-level options under kit: (svelte.config location)', () => {
		const result = applyEdit(SVELTE_CONFIG, 'svelte', addAlias);
		expect(result).toContain('kit:');
		expect(result).toContain('alias:');
	});

	test('routes mixed svelte-level + kit-level keys in one override() call', () => {
		const result = applyEdit(SVELTE_CONFIG, 'svelte', ({ override, js }) => {
			override({
				extensions: js.array.create(),
				alias: js.object.create({ $lib: js.common.createLiteral('./src/lib') })
			});
		});
		// `extensions` is svelte-level (root), `alias` is kit-level (under kit)
		expect(result).toMatch(/extensions:/);
		expect(result).toMatch(/kit:[\s\S]*alias:/);
		// alias must NOT be a root-level sibling of kit
		expect(result.indexOf('alias:')).toBeGreaterThan(result.indexOf('kit:'));
	});

	test('edits an aliased sveltekit() in an arrow defineConfig', () => {
		const result = applyEdit(VITE_CONFIG_ALIASED, 'vite', ({ override, js }) => {
			override({
				adapter: js.functions.createCall({ name: 'adapter', args: [], useIdentifiers: true })
			});
		});
		expect(result).toContain('youhou({');
		expect(result).toContain('adapter: adapter()');
	});

	test('edits the sveltekit() in the exported plugins, not a stray call', () => {
		const result = applyEdit(VITE_CONFIG_TWO_CALLS, 'vite', addAlias);
		// the alias must land in the exported config, after `const unused`, not in the dead const
		expect(result.indexOf('alias:')).toBeGreaterThan(result.indexOf('export default'));
		// the unused const stays a bare sveltekit()
		expect(result).toMatch(/const unused = \{ plugins: \[sveltekit\(\)\] \}/);
	});

	test('creates the default export when editing empty content', () => {
		const result = applyEdit('', 'svelte', addExtension);
		expect(result).toContain('export default');
		expect(result).toContain("extensions: ['.svx']");
	});

	test('scaffolds a vite config (import + sveltekit() plugin) when editing empty content', () => {
		const result = applyEdit('', 'vite', addExtension);
		expect(result).toContain("import { sveltekit } from '@sveltejs/kit/vite'");
		expect(result).toMatch(/plugins:\s*\[[\s\S]*sveltekit\(/);
		expect(result).toContain("extensions: ['.svx']");
	});
});

describe('svelteConfig.edit shapes', () => {
	test('handles `satisfies` config', () => {
		const result = applyEdit(SVELTE_CONFIG_SATISFIES, 'svelte', addAlias);
		expect(result).toContain('alias:');
		expect(result).toContain('satisfies Config');
	});

	test('handles `as` config', () => {
		const result = applyEdit(SVELTE_CONFIG_AS, 'svelte', addAlias);
		expect(result).toContain('alias:');
	});

	test('throws a clear error for a non-object default export', () => {
		expect(() => applyEdit(SVELTE_CONFIG_BAD, 'svelte', addAlias)).toThrow('object literal');
	});
});
