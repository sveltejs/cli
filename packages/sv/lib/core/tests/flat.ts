import { describe, expect, it } from 'vitest';
import { upsert } from '../tooling/flat.ts';

describe('flat.upsert', () => {
	it('key+value on empty content', () => {
		expect(upsert('', 'DATABASE_URL', { value: 'file:local.db' })).toBe(
			'DATABASE_URL=file:local.db\n'
		);
	});

	it('skips existing key', () => {
		const content = 'DATABASE_URL=old\n';
		expect(upsert(content, 'DATABASE_URL', { value: 'new' })).toBe(content);
	});

	it('with comment prefix', () => {
		expect(
			upsert('', 'DATABASE_URL', {
				value: '"libsql://..."',
				comment: 'Replace with your DB credentials!'
			})
		).toBe('# Replace with your DB credentials!\nDATABASE_URL="libsql://..."\n');
	});

	it('with comment after', () => {
		expect(
			upsert('', 'DATABASE_URL', { value: '"libsql://..."', commentAfter: 'adjust as needed' })
		).toBe('DATABASE_URL="libsql://..."\n# adjust as needed\n');
	});

	it('with comment before and after', () => {
		expect(
			upsert('', 'DATABASE_URL', {
				value: '"libsql://..."',
				comment: 'before',
				commentAfter: 'after'
			})
		).toBe('# before\nDATABASE_URL="libsql://..."\n# after\n');
	});

	it('key-only (gitignore style)', () => {
		expect(upsert('', '*.db')).toBe('*.db\n');
	});

	it('handles content without trailing newline', () => {
		expect(upsert('FOO=bar', 'BAZ', { value: 'qux' })).toBe('FOO=bar\nBAZ=qux\n');
	});

	it('handles content with trailing newline', () => {
		expect(upsert('FOO=bar\n', 'BAZ', { value: 'qux' })).toBe('FOO=bar\nBAZ=qux\n');
	});

	it('skips duplicate gitignore entry', () => {
		const content = '*.db\n';
		expect(upsert(content, '*.db')).toBe(content);
	});

	it('trims key whitespace', () => {
		expect(upsert('', ' DATABASE_URL ', { value: 'file:local.db' })).toBe(
			'DATABASE_URL=file:local.db\n'
		);
	});

	it('skips existing key with spaces around =', () => {
		const content = 'DATABASE_URL = old\n';
		expect(upsert(content, 'DATABASE_URL', { value: 'new' })).toBe(content);
	});

	it('skips existing key with leading whitespace', () => {
		const content = '  DATABASE_URL=old\n';
		expect(upsert(content, 'DATABASE_URL', { value: 'new' })).toBe(content);
	});
});
