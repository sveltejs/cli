import dedent from 'dedent';
import { describe, it, expect } from 'vitest';
import { minimizeDiff, sanitizeName } from '../sanitize.ts';

const testCases: Array<{ input: string; expected: string; expectedPackage?: string }> = [
	// Basic cases
	{ input: 'my-project', expected: 'my-project' },
	{ input: 'myproject', expected: 'myproject' },

	// Dots
	{ input: 'sub.example.com', expected: 'sub-example-com', expectedPackage: 'sub.example.com' },
	{ input: 'my.cool.app', expected: 'my-cool-app', expectedPackage: 'my.cool.app' },

	// Underscores
	{ input: 'my_project_name', expected: 'my-project-name' },

	// Mixed cases
	{ input: 'My_Project.Name', expected: 'my-project-name', expectedPackage: 'my-project.name' },
	{ input: 'MyAwesomeApp', expected: 'myawesomeapp' },

	// Special characters
	{ input: '@scope/package', expected: 'scope-package', expectedPackage: '@scope/package' },
	{ input: 'hello@world!test', expected: 'hello-world-test' },

	// Multiple consecutive invalid chars
	{ input: 'my..project__name', expected: 'my-project-name', expectedPackage: 'my..project-name' },

	// Leading/trailing invalid chars
	{ input: '.my-project.', expected: 'my-project', expectedPackage: 'my-project.' },
	{ input: '---test---', expected: 'test', expectedPackage: '---test---' },

	// Numbers
	{ input: 'project123', expected: 'project123' },
	{ input: '123project', expected: '123project' },

	// Empty/invalid fallback
	{ input: '___', expected: 'undefined-sv-name', expectedPackage: '-' },
	{ input: '!@#$%', expected: 'undefined-sv-name', expectedPackage: '-' },
	{ input: '', expected: 'undefined-sv-name' },

	// Length limit (63 chars max)
	{ input: 'a'.repeat(70), expected: 'a'.repeat(63), expectedPackage: 'a'.repeat(70) },
	{
		input: 'my-very-long-project-name-that-exceeds-the-limit-of-63-characters-allowed',
		expected: 'my-very-long-project-name-that-exceeds-the-limit-of-63-characte',
		expectedPackage: 'my-very-long-project-name-that-exceeds-the-limit-of-63-characters-allowed'
	},

	// Truncation trap: slice leaves trailing dash
	{
		input: 'a'.repeat(62) + '-b',
		expected: 'a'.repeat(62),
		expectedPackage: 'a'.repeat(62) + '-b'
	},

	// Spaces
	{ input: 'my cool project', expected: 'my-cool-project' },
	{ input: '  spaced  out  ', expected: 'spaced-out' },

	// Exact boundary (off-by-one check)
	{ input: 'a'.repeat(63), expected: 'a'.repeat(63) },

	// Unicode / accents / emojis (replaced with dashes)
	{ input: 'piñata', expected: 'pi-ata' },
	{ input: 'café', expected: 'caf', expectedPackage: 'caf-' },
	{ input: 'cool 🚀 app', expected: 'cool-app', expectedPackage: 'cool---app' }
];

describe('sanitizeName wrangler', () => {
	it.each(testCases)('sanitizes $input to $expected', ({ input, expected }) => {
		expect(sanitizeName(input, 'wrangler')).toBe(expected);
	});
});

describe('sanitizeName package', () => {
	it.each(testCases)('sanitizes $input to $expected', ({ input, expected, expectedPackage }) => {
		expect(sanitizeName(input, 'package')).toBe(expectedPackage ?? expected);
	});
});

describe('minimizeDiff', () => {
	it('preserves blank lines from the original content', () => {
		const old = dedent`
			console.log('line1');

			console.log('line2');
			console.log('line3');
		`;

		const updated = dedent`
			console.log('line1');
			console.log('line2');
			console.log('line3');
		`;

		expect(minimizeDiff(old, updated)).toBe(old);
	});

	it('drops blank lines introduced by the updated content', () => {
		const old = dedent`
			console.log('line1');
			console.log('line2');
			console.log('line3');
		`;

		const updated = dedent`
			console.log('line1');

			console.log('line2');
			console.log('line3');
		`;

		expect(minimizeDiff(old, updated)).toBe(old);
	});

	it('keeps content replacements from the updated content', () => {
		const old = dedent`
			console.log('line1');
			console.log('old');
			console.log('line3');
		`;

		const updated = dedent`
			console.log('line1');
			console.log('updated');
			console.log('line3');
		`;

		expect(minimizeDiff(old, updated)).toBe(updated);
	});

	it('does not restore deleted nonblank lines', () => {
		const old = dedent`
			console.log('line1');
			console.log('deleted');
			console.log('line3');
		`;

		const updated = dedent`
			console.log('line1');
			console.log('line3');
		`;

		expect(minimizeDiff(old, updated)).toBe(updated);
	});

	it('drops multiple added whitespace-only blank lines', () => {
		const old = "console.log('line1');\nconsole.log('line2');";
		const updated = "console.log('line1');\n\n\t\n \nconsole.log('line2');";

		expect(minimizeDiff(old, updated)).toBe(old);
	});

	it('keeps an original blank line that is bundled into a real change', () => {
		// The diff groups the leading blank line together with the changed line. The blank line is
		// layout, not content, so it must survive even though the adjacent line really changed.
		const old = dedent`
			const x = 1;

			const y = 2;
		`;

		const updated = dedent`
			const x = 1;
			const y = 3;
		`;

		const expected = dedent`
			const x = 1;

			const y = 3;
		`;

		expect(minimizeDiff(old, updated)).toBe(expected);
	});

	it('drops printer-inserted blank lines even when the whole region is one changed hunk', () => {
		// When every line differs (e.g. semicolons added throughout) the diff collapses into a single
		// changed hunk. Printer-inserted blank lines must still be dropped, keeping the real change.
		const old = dedent`
			const p = samples[env.KEY]
			if (!p) return null
			return view.project(p.lat, p.lon)
		`;

		const updated = dedent`
			const p = samples[ENV_KEY];

			if (!p) return null;

			return view.project(p.lat, p.lon);
		`;

		const expected = dedent`
			const p = samples[ENV_KEY];
			if (!p) return null;
			return view.project(p.lat, p.lon);
		`;

		expect(minimizeDiff(old, updated)).toBe(expected);
	});

	it('restores formatting-only hunks when the original uses CRLF line endings', () => {
		// On Windows the original file is often checked out with CRLF while the printer emits LF.
		// Without normalization the diff collapses into a single hunk and the formatting-only
		// restoration never fires. The result is always normalized to LF.
		const oldLf = dedent`
			import { x } from './old.ts';
			function load() {
				return {
					a,
					b
				};
			}
		`;
		const oldCrlf = oldLf.replace(/\n/g, '\r\n');

		// printer rewrites the import (real change) and collapses the object (formatting only)
		const updated = dedent`
			import { x } from './new.ts';
			function load() {
				return { a, b };
			}
		`;

		const expected = dedent`
			import { x } from './new.ts';
			function load() {
				return {
					a,
					b
				};
			}
		`;

		expect(minimizeDiff(oldCrlf, updated)).toBe(expected);
		// CRLF and LF originals must produce identical output
		expect(minimizeDiff(oldCrlf, updated)).toBe(minimizeDiff(oldLf, updated));
	});

	it('uses updated content when it replaces an original blank line', () => {
		const old = dedent`
			console.log('line1');
			
			console.log('line3');
		`;

		const updated = dedent`
			console.log('line1');
			
			console.log('inserted');
			console.log('line3');
		`;

		expect(minimizeDiff(old, updated)).toBe(updated);
	});

	it('keeps one separator after newly inserted imports', () => {
		const old = dedent`
			import a from 'a';

			export default {};
		`;

		const updated = dedent`
			import a from 'a';
			import b from 'b';

			export default {};
		`;

		expect(minimizeDiff(old, updated)).toBe(updated);
	});

	it('does not duplicate the separator after a replaced import block', () => {
		const old = dedent`
			import a from 'a';

			export default {};
		`;

		const updated = dedent`
			import b from 'b';
			import c from 'c';

			export default {};
		`;

		expect(minimizeDiff(old, updated)).toBe(updated);
	});

	it('restores a hunk that only collapsed whitespace', () => {
		const old = dedent`
			type RequestAuthContext = {
				authToken?: string;
				hasValidAuthToken: boolean;
			};

			const requestAuthContextStorage = new AsyncLocalStorage<RequestAuthContext>();
		`;

		const updated = dedent`
			type RequestAuthContext = { authToken?: string; hasValidAuthToken: boolean; };

			const requestAuthContextStorage = new AsyncLocalStorage<RequestAuthContext>();
		`;

		expect(minimizeDiff(old, updated)).toBe(old);
	});

	it('restores original formatting when only statement semicolons changed', () => {
		const old = dedent`
			const first = 1
			const second = 2
		`;

		const updated = dedent`
			const first = 1;
			const second = 2;
		`;

		expect(minimizeDiff(old, updated)).toBe(old);
	});

	it('restores original formatting when only trailing commas changed', () => {
		const old = dedent`
			const config = {
				extensions: [
					'.svelte',
					'.svx'
				]
			};
		`;

		const updated = dedent`
			const config = {
				extensions: [
					'.svelte',
					'.svx',
				],
			};
		`;

		expect(minimizeDiff(old, updated)).toBe(old);
	});

	it('restores original formatting when an object literal is expanded', () => {
		const old = dedent`
			export function getStaticEnvValues() {
				return { private: ENV_PRIVATE_STATIC_1, public: publicStaticEnv };
			}
		`;

		const updated = dedent`
			export function getStaticEnvValues() {
				return {
					private: ENV_PRIVATE_STATIC_1,
					public: publicStaticEnv
				};
			}
		`;

		expect(minimizeDiff(old, updated)).toBe(old);
	});

	it('keeps updated hunks when non-trailing commas change the meaning', () => {
		const old = dedent`
			const values = ['a' + 'b'];
		`;

		const updated = dedent`
			const values = ['a', 'b'];
		`;

		expect(minimizeDiff(old, updated)).toBe(updated);
	});

	it('keeps updated hunks with non-whitespace changes', () => {
		const old = dedent`
			import { env } from '$env/dynamic/private';

			if (env.API_BASE_URL) {
				client.setConfig({ baseUrl: env.API_BASE_URL });
			}
		`;

		const updated = dedent`
			import { API_BASE_URL } from '$app/env/private';

			if (API_BASE_URL) {
				client.setConfig({ baseUrl: API_BASE_URL });
			}
		`;

		expect(minimizeDiff(old, updated)).toBe(updated);
	});
});
