import { describe, expect, it } from 'vitest';
import { commandExists } from '../command.ts';

describe('commandExists', () => {
	it('returns true for a command that exists', () => {
		// the test runner is node itself, so it must be on the PATH
		expect(commandExists('node')).toBe(true);
	});

	it('returns false for a command that does not exist', () => {
		expect(commandExists('definitely-not-a-real-command-xyz-42')).toBe(false);
	});

	it('throws for an empty string', () => {
		expect(() => commandExists('')).toThrow('`command` cannot be empty');
	});
});
