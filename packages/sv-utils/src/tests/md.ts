import { describe, expect, it } from 'vitest';
import { upsert } from '../tooling/md.ts';

describe('md upsert', () => {
	it("adds to the end when there's no header option", () => {
		const content = '# Hello\n\nSome content\n\n## World\n';
		const result = upsert(content, ['new line']);
		expect(result).toBe('# Hello\n\nSome content\n\n## World\n\nnew line\n');
	});

	it('add lines under existing header', () => {
		const content = '# Hello\n\nSome content\n\n## World\n';
		const result = upsert(content, ['new line'], { header: '# Hello' });
		expect(result).toBe('# Hello\n\nSome content\nnew line\n\n## World\n');

		const result2 = upsert(content, ['new line'], { header: '## World' });
		expect(result2).toBe('# Hello\n\nSome content\n\n## World\n\nnew line\n');
	});

	it('create new header section when not found', () => {
		const content = '# Existing\n\ncontent';
		const result = upsert(content, ['new line'], { header: '## New Section' });
		expect(result).toBe('# Existing\n\ncontent\n\n## New Section\n\nnew line\n');
	});

	it('works with different header levels', () => {
		expect(upsert('', ['line'], { header: '# H1' })).toBe('# H1\n\nline\n');
		expect(upsert('', ['line'], { header: '## H2' })).toBe('## H2\n\nline\n');
		expect(upsert('', ['line'], { header: '### H3' })).toBe('### H3\n\nline\n');
		expect(upsert('', ['line'], { header: '#### H4' })).toBe('#### H4\n\nline\n');
		expect(upsert('', ['line'], { header: '##### H5' })).toBe('##### H5\n\nline\n');
		expect(upsert('', ['line'], { header: '###### H6' })).toBe('###### H6\n\nline\n');
	});

	it('filters falsy values from lines', () => {
		const content = '# Section\n';
		const result = upsert(content, ['valid', false, null, undefined, 0, 0n, '', 'also valid'], {
			header: '# Section'
		});
		expect(result).toBe('# Section\n\nvalid\nalso valid\n');
	});

	it('adds multiple lines', () => {
		const content = '# Section';
		const result = upsert(content, ['line 1', 'line 2', 'line 3'], { header: '# Section' });
		expect(result).toBe('# Section\n\nline 1\nline 2\nline 3\n');
	});

	it('handles a header containing all common regex metacharacters', () => {
		const trickyHeader = '# [v1.0]* + (Review)? ^Search$ | {Match}.';
		const content = `${trickyHeader}\nexisting_data: true`;
		const linesToAdd = 'new_data: true';

		const result = upsert(content, [linesToAdd], { header: trickyHeader });

		expect(result).toContain(`${trickyHeader}\nexisting_data: true\n${linesToAdd}\n`);
	});

	it('appends lines without header', () => {
		const content = 'existing content';
		const result = upsert(content, ['new line'], {});
		expect(result).toBe('existing content\nnew line\n');
	});

	it('appends to content ending with newline', () => {
		const content = 'existing content\n';
		const result = upsert(content, ['new line'], {});
		expect(result).toBe('existing content\nnew line\n');
	});
});
