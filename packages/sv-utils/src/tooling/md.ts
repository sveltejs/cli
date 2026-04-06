type Header = `${'#' | '##' | '###' | '####' | '#####' | '######'} ${string}`;

const HEADER_REGEX = /^#{1,6} .+$/m;

export function upsert(
	content: string,
	lines: Array<string | false | undefined | null | 0 | 0n>,
	options?: {
		header?: Header;
		mode?: 'prepend' | 'append';
	}
): string {
	const { header, mode = 'append' } = options ?? {};
	const linesToAdd = lines.filter(Boolean).join('\n');

	if (!header) {
		return joinContent(content, linesToAdd);
	}

	const headerMatch = findHeader(content, header);

	if (!headerMatch) {
		return joinContent(content, header, linesToAdd);
	}
	const { end: headerLineEnd, after: restOfContent } = headerMatch;

	const nextHeaderMatch = restOfContent.match(HEADER_REGEX);

	let insertPos: number;
	if (mode === 'prepend') {
		insertPos = headerLineEnd + 1;
	} else if (nextHeaderMatch) {
		insertPos = headerLineEnd + 1 + restOfContent.indexOf(nextHeaderMatch[0]);
	} else {
		insertPos = content.length;
	}

	const before = content.slice(0, insertPos);
	const after = content.slice(insertPos);

	return joinContent(before, linesToAdd, after);
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ensure the distance between a header and a non-header is always \n\n
 */
function joinContent(...args: string[]): string {
	const trimmedArgs = args.map((content) => content.trim()).filter((content) => content !== '');

	if (trimmedArgs.length === 0) return '';
	if (trimmedArgs.length === 1) return `${trimmedArgs[0]}\n`;

	let result = trimmedArgs[0];
	for (let i = 1; i < trimmedArgs.length; i++) {
		const prev = result.trimEnd();
		const prevLastLine = prev.split('\n').at(-1)!;
		const prevIsHeader = HEADER_REGEX.test(prevLastLine);

		const curr = trimmedArgs[i];
		const currFirstLine = curr.split('\n').at(0)!;
		const currIsHeader = HEADER_REGEX.test(currFirstLine);

		const separator = prevIsHeader || currIsHeader ? '\n\n' : '\n';
		result = `${prev}${separator}${curr}`;
	}
	return `${result}\n`;
}

function findHeader(
	content: string,
	header: Header
): { before: string; after: string; start: number; end: number } | null {
	const [headerLevel, ...headerNameArray] = header.split(' ');
	const headerName = headerNameArray.join(' ');

	const sectionRegex = new RegExp(`^(${headerLevel}) ${escapeRegex(headerName)}\\s*$`, 'm');
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
