import { describe, expect, it } from 'vitest';
import { findHeader, findSection, joinContent } from '../tooling/md.ts';

describe('joinContent', () => {
	it('joins two non-headers', () => {
		const result = joinContent('hello', 'world');
		expect(result).toBe('hello\nworld\n');
	});

	it('joins a header and a non-header', () => {
		const result = joinContent('# Hello', 'content');
		expect(result).toBe('# Hello\n\ncontent\n');
	});

	it('joins two headers', () => {
		const result = joinContent('# Hello', '## World');
		expect(result).toBe('# Hello\n\n## World\n');
	});

	it('joins a non-header and a header', () => {
		const result = joinContent('content', '# Next');
		expect(result).toBe('content\n\n# Next\n');
	});

	it('filters out empty strings', () => {
		const result = joinContent('hello', '', 'world');
		expect(result).toBe('hello\nworld\n');
	});

	it('returns an empty string when all inputs are empty', () => {
		const result = joinContent('', '', '');
		expect(result).toBe('');
	});

	it('trims content before joining', () => {
		const result = joinContent('  hello  ', '  world  ');
		expect(result).toBe('hello\nworld\n');
	});

	it('handles a single argument', () => {
		const result = joinContent('hello');
		expect(result).toBe('hello\n');
	});
});

describe('findHeader', () => {
	it('finds a header', () => {
		const content = '# Hello\n\nSome content\n\n## World\n';
		const result = findHeader(content, '# Hello');

		expect(result).not.toBeNull();
		expect(result!.start).toBe(0);
		expect(result!.end).toBe(7);
		expect(result!.before).toBe('');
		expect(result!.after).toBe('\nSome content\n\n## World\n');
	});

	it('returns null when the header is not found', () => {
		const content = '# Hello\n\nSome content';
		const result = findHeader(content, '## Missing');

		expect(result).toBeNull();
	});

	it('finds a header in the middle of content', () => {
		const content = 'some prefix\n\n# Header\n\nsome suffix';
		const result = findHeader(content, '# Header');

		expect(result).not.toBeNull();
		expect(result!.before).toBe('some prefix\n\n');
		expect(result!.after).toBe('\nsome suffix');
	});

	it('handles different header levels', () => {
		const content = '## H2\n\n### H3\n\n#### H4';

		expect(findHeader(content, '## H2')).not.toBeNull();
		expect(findHeader(content, '### H3')).not.toBeNull();
		expect(findHeader(content, '#### H4')).not.toBeNull();
	});

	it('finds a header with trailing whitespace', () => {
		const content = '# Header  \ncontent';
		const result = findHeader(content, '# Header');

		expect(result).not.toBeNull();
	});

	it('finds the first occurrence when duplicate headers exist', () => {
		const content = '# Title\n\ncontent1\n\n# Title\n\ncontent2';
		const result = findHeader(content, '# Title');

		expect(result).not.toBeNull();
		expect(result!.before).toBe('');
		expect(result!.after).toBe('\ncontent1\n\n# Title\n\ncontent2');
	});

	it('handles a header with special regex characters', () => {
		const content = '# [test]* (example) $special\ncontent';
		const result = findHeader(content, '# [test]* (example) $special');

		expect(result).not.toBeNull();
	});
});

describe('findSection', () => {
	it('finds a section and returns the header with its inner content', () => {
		const content = '# Hello\n\nSome content\n\n## World\nmore content\n\n# Another';
		const result = findSection(content, '# Hello');

		expect(result).not.toBeNull();
		expect(result!.header).toBe('# Hello');
		expect(result!.innerContent).toBe('\n\nSome content\n\n## World\nmore content\n\n');
	});

	it('returns null when the header is not found', () => {
		const content = '# Existing\ncontent';
		const result = findSection(content, '## Missing');

		expect(result).toBeNull();
	});

	it('should all add up', () => {
		const content =
			'# Parent\n\n## Child\nchild content\n\n### Grandchild\ngc content\n\n### Hmm\n\n## Two\n\n## One';
		const result = findSection(content, '## Child');

		expect(result).not.toBeNull();
		expect(
			result!.before.length +
				result!.header.length +
				result!.innerContent.length +
				result!.after.length
		).toEqual(content.length);
	});

	it('finds a section up to the next header of the same level', () => {
		const content = '# Parent\n\n## Child1\ncontent1\n\n## Child2\ncontent2\n\n# Sibling';
		const result = findSection(content, '# Parent');

		expect(result).not.toBeNull();
		expect(result!.innerContent).toBe('\n\n## Child1\ncontent1\n\n## Child2\ncontent2\n\n');
	});

	it('finds a nested section within a parent', () => {
		const content =
			'# Parent\n\n## Child\nchild content\n\n### Grandchild\ngc content\n\n### Hmm\n\n## Two\n\n## One';
		const result = findSection(content, '## Child');

		expect(result).not.toBeNull();
		expect(result!.header).toBe('## Child');
		expect(result!.innerContent).toBe(
			'\nchild content\n\n### Grandchild\ngc content\n\n### Hmm\n\n'
		);
	});

	it('handles a section at the end of content', () => {
		const content = '# Last\n\nfinal content';
		const result = findSection(content, '# Last');

		expect(result).not.toBeNull();
		expect(result!.innerContent).toBe('\n\nfinal content');
	});

	it('returns the inner content for a header with no content', () => {
		const content = '# Empty\n\n## Next';
		const result = findSection(content, '# Empty');

		expect(result).not.toBeNull();
		expect(result!.innerContent).toBe('\n\n## Next');
	});
});
