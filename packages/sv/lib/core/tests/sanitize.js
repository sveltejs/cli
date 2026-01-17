import { describe, it, expect } from 'vitest';
import { sanitizeName } from '../sanitize.js';

/** @type {Array<{ input: string; expected: string; expectedPackage?: string }>} */
const testCases = [
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
