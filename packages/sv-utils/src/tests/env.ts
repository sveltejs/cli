import { describe, expect, test } from 'vitest';
import { resolveEnvMode } from '../env.ts';

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

import { defineEnv } from '../env.ts';
import * as js from '../tooling/js/index.ts';
import { parseScript } from '../tooling/parsers.ts';

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

function envFor(kitRange: string) {
	const { sv, files } = fakeSv();
	const env = defineEnv({ sv, cwd: '/proj', language: 'ts', dependencyVersion: () => kitRange });
	return { env, files };
}

describe('defineEnv.reference', () => {
	test('declared: named import from $app/env/private + bare accessor', () => {
		const { env } = envFor('next');
		const { ast, generateCode } = parseScript('');
		const access = env.reference(ast, js, { name: 'DATABASE_URL' });
		expect(access).toBe('DATABASE_URL');
		expect(generateCode()).toContain("import { DATABASE_URL } from '$app/env/private';");
	});

	test('legacy dynamic: env import + env.DATABASE_URL accessor', () => {
		const { env } = envFor('^2.0.0');
		const { ast, generateCode } = parseScript('');
		const access = env.reference(ast, js, { name: 'DATABASE_URL' });
		expect(access).toBe('env.DATABASE_URL');
		expect(generateCode()).toContain("import { env } from '$env/dynamic/private';");
	});

	test('legacy static: named import from $env/static/public + bare accessor', () => {
		const { env } = envFor('^2.0.0');
		const { ast, generateCode } = parseScript('');
		const access = env.reference(ast, js, { name: 'PUBLIC_X', scope: 'public', static: true });
		expect(access).toBe('PUBLIC_X');
		expect(generateCode()).toContain("import { PUBLIC_X } from '$env/static/public';");
	});
});
