import { describe, it, expect } from 'vitest';
import { sanitizeWranglerName } from '../../cli/add/utils.ts';

describe('sanitizeWranglerName', () => {
	const testCases = [
		// Basic cases
		{ input: 'my-project', expected: 'my-project' },
		{ input: 'myproject', expected: 'myproject' },

		// Dots
		{ input: 'sub.example.com', expected: 'sub-example-com' },
		{ input: 'my.cool.app', expected: 'my-cool-app' },

		// Underscores
		{ input: 'my_project_name', expected: 'my-project-name' },

		// Mixed cases
		{ input: 'My_Project.Name', expected: 'my-project-name' },
		{ input: 'MyAwesomeApp', expected: 'myawesomeapp' },

		// Special characters
		{ input: '@scope/package', expected: 'scope-package' },
		{ input: 'hello@world!test', expected: 'hello-world-test' },

		// Multiple consecutive invalid chars
		{ input: 'my..project__name', expected: 'my-project-name' },

		// Leading/trailing invalid chars
		{ input: '.my-project.', expected: 'my-project' },
		{ input: '---test---', expected: 'test' },

		// Numbers
		{ input: 'project123', expected: 'project123' },
		{ input: '123project', expected: '123project' },

		// Empty/invalid fallback
		{ input: '___', expected: 'undefined-project-name' },
		{ input: '!@#$%', expected: 'undefined-project-name' },
		{ input: '', expected: 'undefined-project-name' },

		// Length limit (63 chars max)
		{ input: 'a'.repeat(70), expected: 'a'.repeat(63) },
		{
			input: 'my-very-long-project-name-that-exceeds-the-limit-of-63-characters-allowed',
			expected: 'my-very-long-project-name-that-exceeds-the-limit-of-63-characte'
		},

		// Truncation trap: slice leaves trailing dash
		{ input: 'a'.repeat(62) + '-b', expected: 'a'.repeat(62) },

		// Spaces
		{ input: 'my cool project', expected: 'my-cool-project' },
		{ input: '  spaced  out  ', expected: 'spaced-out' },

		// Exact boundary (off-by-one check)
		{ input: 'a'.repeat(63), expected: 'a'.repeat(63) },

		// Unicode / accents / emojis (replaced with dashes)
		{ input: 'piñata', expected: 'pi-ata' },
		{ input: 'café', expected: 'caf' },
		{ input: 'cool 🚀 app', expected: 'cool-app' }
	];

	it.each(testCases)('sanitizes "$input" to "$expected"', ({ input, expected }) => {
		expect(sanitizeWranglerName(input)).toBe(expected);
	});
});
