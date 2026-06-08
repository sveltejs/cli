import { describe, expect, test } from 'vitest';
import { _bindEnv, readExplicitEnvFlag, resolveEnvMode, type EnvMode } from '../env.ts';
import * as js from '../tooling/js/index.ts';
import { parseScript } from '../tooling/parsers.ts';

describe('resolveEnvMode', () => {
	test('no kit -> legacy', () => {
		expect(resolveEnvMode({ kitRange: undefined, explicitEnvFlag: false })).toBe('legacy');
	});
	test('kit 2 default -> legacy', () => {
		expect(resolveEnvMode({ kitRange: '^2.0.0', explicitEnvFlag: false })).toBe('legacy');
	});
	test('kit 2 + explicit flag -> declared', () => {
		expect(resolveEnvMode({ kitRange: '^2.0.0', explicitEnvFlag: true })).toBe('declared');
	});
	test('kit 3 range -> declared', () => {
		expect(resolveEnvMode({ kitRange: '^3.0.0-next.1', explicitEnvFlag: false })).toBe('declared');
	});
	test('next dist-tag -> declared', () => {
		expect(resolveEnvMode({ kitRange: 'next', explicitEnvFlag: false })).toBe('declared');
	});
});

/** A fake `sv` capturing file writes in-memory. */
function fakeSv(files: Record<string, string> = {}) {
	return {
		files,
		sv: {
			file(path: string, edit: (content: string) => string | false) {
				const out = edit(files[path] ?? '');
				if (out !== false) files[path] = out;
			}
		}
	};
}

function envFor(mode: EnvMode) {
	const { sv, files } = fakeSv();
	const env = _bindEnv({ sv, mode, language: 'ts' });
	return { env, files };
}

describe('defineEnv.reference', () => {
	test('declared: named import from $app/env/private + bare accessor', () => {
		const { env } = envFor('declared');
		const { ast, generateCode } = parseScript('');
		const access = env.reference(ast, js, { name: 'DATABASE_URL' });
		expect(access).toBe('DATABASE_URL');
		expect(generateCode()).toContain("import { DATABASE_URL } from '$app/env/private';");
	});

	test('legacy dynamic: env import + env.DATABASE_URL accessor', () => {
		const { env } = envFor('legacy');
		const { ast, generateCode } = parseScript('');
		const access = env.reference(ast, js, { name: 'DATABASE_URL' });
		expect(access).toBe('env.DATABASE_URL');
		expect(generateCode()).toContain("import { env } from '$env/dynamic/private';");
	});

	test('legacy static: named import from $env/static/public + bare accessor', () => {
		const { env } = envFor('legacy');
		const { ast, generateCode } = parseScript('');
		const access = env.reference(ast, js, { name: 'PUBLIC_X', scope: 'public', static: true });
		expect(access).toBe('PUBLIC_X');
		expect(generateCode()).toContain("import { PUBLIC_X } from '$env/static/public';");
	});
});

const reader = (files: Record<string, string>) => (path: string) => files[path] ?? null;

describe('readExplicitEnvFlag', () => {
	test('true when set in svelte.config', () => {
		const files = {
			'svelte.config.js':
				'export default { kit: { experimental: { explicitEnvironmentVariables: true } } };\n'
		};
		expect(readExplicitEnvFlag(reader(files))).toBe(true);
	});
	test('false when absent', () => {
		const files = { 'svelte.config.js': 'export default { kit: {} };\n' };
		expect(readExplicitEnvFlag(reader(files))).toBe(false);
	});
	test('false when no config', () => {
		expect(readExplicitEnvFlag(reader({}))).toBe(false);
	});
});

describe('defineEnv.define', () => {
	test('declared: creates src/env.ts with defineEnvVars + description', () => {
		const { env, files } = envFor('declared');
		env.define({ name: 'DATABASE_URL', description: 'db url' });
		const out = files['src/env.ts'];
		expect(out).toContain("import { defineEnvVars } from '@sveltejs/kit/hooks';");
		expect(out).toContain('export const variables = defineEnvVars({');
		expect(out).toContain('DATABASE_URL');
		expect(out).toContain("description: 'db url'");
	});

	test('declared: second define merges into the same variables object', () => {
		const { env, files } = envFor('declared');
		env.define({ name: 'DATABASE_URL' });
		env.define({ name: 'DATABASE_AUTH_TOKEN' });
		const out = files['src/env.ts'];
		expect(out).toContain('DATABASE_URL');
		expect(out).toContain('DATABASE_AUTH_TOKEN');
		expect(out.match(/defineEnvVars/g)?.length).toBe(2); // import + one call, no duplicate object
	});

	test('legacy: define is a no-op (no env file written)', () => {
		const { env, files } = envFor('legacy');
		env.define({ name: 'DATABASE_URL' });
		expect(files['src/env.ts']).toBeUndefined();
	});
});
