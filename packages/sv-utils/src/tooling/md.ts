type Header = `${'#' | '##' | '###' | '####' | '#####' | '######'} ${string}`;
export type Line = string | false | undefined | null | 0 | 0n;

const HEADER_REGEX = /^#{1,6} .+$/m;

function getHeaderLevel(header: Header): number {
	return header.split(' ')[0].length;
}

// vendor from https://github.com/sindresorhus/escape-string-regexp/blob/main/index.js
export function escapeStringRegexp(string: string): string {
	// Escape characters with special meaning either inside or outside character sets.
	// Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
	return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

/**
 * Ensure the distance between a header and a non-header is always \n\n
 */
export function joinContent(...args: string[]): string {
	const trimmedArgs = args.map((content) => content.trim()).filter((content) => content !== '');

	if (trimmedArgs.length === 0) return '';
	if (trimmedArgs.length === 1) return `${trimmedArgs[0]}\n`;

	let result = trimmedArgs[0];
	for (let i = 1; i < trimmedArgs.length; i++) {
		const prev = result.trimEnd();
		const prevLastLine = prev.split('\n').at(-1) ?? '';
		const prevIsHeader = HEADER_REGEX.test(prevLastLine);

		const curr = trimmedArgs[i];
		const currFirstLine = curr.split('\n').at(0) ?? '';
		const currIsHeader = HEADER_REGEX.test(currFirstLine);

		const separator = prevIsHeader || currIsHeader ? '\n\n' : '\n';
		result = `${prev}${separator}${curr}`;
	}
	return `${result}\n`;
}

export function findHeader(
	content: string,
	header: Header
): { before: string; after: string; start: number; end: number } | null {
	const [headerLevel, ...headerNameArray] = header.split(' ');
	const headerName = headerNameArray.join(' ');

	const sectionRegex = new RegExp(`^(${headerLevel}) ${escapeStringRegexp(headerName)}\\s*$`, 'm');
	const headerMatch = content.match(sectionRegex);

	if (!headerMatch) return null;

	const start = headerMatch.index!;
	const end = start + header.length;

	return {
		start,
		end,
		before: content.slice(0, start),
		after: content.slice(end + 1)
	};
}

export function findSection(
	content: string,
	header: Header
): {
	before: string;
	after: string;
	header: Header;
	innerContent: string;
	start: number;
	end: number;
} | null {
	const headerMatch = findHeader(content, header);

	if (!headerMatch) return null;

	const { start, end: headerEnd, before } = headerMatch;
	const level = getHeaderLevel(header);
	const nextHeaderRegex = new RegExp(`^#{${level}} `, 'm');
	const afterHeader = content.slice(headerEnd);
	const nextHeaderMatch = afterHeader.match(nextHeaderRegex);

	let end: number;
	if (nextHeaderMatch) {
		end = headerEnd + nextHeaderMatch.index!;
	} else {
		end = content.length;
	}

	const innerContent = content.slice(headerEnd, end);
	const after = content.slice(end);

	return {
		before,
		after,
		header,
		innerContent,
		start,
		end
	};
}

export function appendContent(content: string, linesToAdd: string, header: Header): string {
	const section = findSection(content, header);

	if (!section) {
		return joinContent(content, header, linesToAdd);
	}

	const { start, end, innerContent } = section;
	const firstNextHeaderMatch = innerContent.match(HEADER_REGEX);

	let insertPos: number;
	if (firstNextHeaderMatch) {
		insertPos = start + header.length + 1 + innerContent.indexOf(firstNextHeaderMatch[0]);
	} else {
		insertPos = end;
	}

	const before = content.slice(0, insertPos);
	const after = content.slice(insertPos);

	return joinContent(before, linesToAdd, after);
}
