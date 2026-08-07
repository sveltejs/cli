import { parse } from '@sveltejs/sv-utils';
import { describe, expect, test } from 'vitest';
import {
	MIGRATION_TASK_MARKER,
	addMigrationTask,
	getMigrationTaskCount,
	resetMigrationTaskCount
} from './migration-task.ts';

describe('addMigrationTask (svelte fragment target)', () => {
	test('prints a real svelte comment and bumps the count', () => {
		resetMigrationTaskCount();
		const before = getMigrationTaskCount();

		const { ast, generateCode } = parse.svelte('<p>hello</p>\n');
		addMigrationTask('do something manually', { fragment: ast.fragment });

		const code = generateCode();
		expect(code).toContain(`<!-- ${MIGRATION_TASK_MARKER} do something manually -->`);
		expect(getMigrationTaskCount()).toBe(before + 1);
	});

	test('inserts before the anchor node when it is a direct fragment child', () => {
		const { ast, generateCode } = parse.svelte('<p>a</p>\n<span>b</span>\n');
		const anchor = ast.fragment.nodes.find(
			(node) => node.type === 'RegularElement' && node.name === 'span'
		);
		addMigrationTask('near span', { fragment: ast.fragment, anchor });

		const code = generateCode();
		expect(code.indexOf('@migration-task')).toBeLessThan(code.indexOf('<span'));
		expect(code.indexOf('<p')).toBeLessThan(code.indexOf('@migration-task'));
	});
});
