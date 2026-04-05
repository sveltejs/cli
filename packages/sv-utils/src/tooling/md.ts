type Header = `${'#' | '##' | '###' | '####' | '#####' | '######'} ${string}`;

const HEADER_REGEX = /^#{1,6} .+$/m;

export function upsert(
	content: string,
	lines: Array<string | false | undefined | null | 0 | 0n>,
	options?: {
		header?: Header;
		// mode: 'prepend'|'append',
		// position: Header
	}
): string {
	const { header } = options ?? {};

	const linesToAdd = lines.filter(Boolean).join('\n');

	if (!header) {
		return joinContent(content, `${linesToAdd}\n`);
	}

	const [headerLevel, ...headerNameArray] = header.split(' ');
	const headerName = headerNameArray.join(' ');
	const sectionRegex = new RegExp(`^(${headerLevel}) ${escapeRegex(headerName)}\\s*$`, 'm');
	const headerMatch = content.match(sectionRegex);

	if (!headerMatch) {
		const length = content.trim().length;
		const separator = length ? '\n\n' : '';

		return `${content.trimEnd()}${separator}${header}\n\n${linesToAdd}\n`;
	}

	const headerStart = headerMatch.index!;
	const headerLineEnd = content.indexOf('\n', headerStart);
	const restOfContent = content.slice(headerLineEnd + 1);
	const nextHeaderMatch = restOfContent.match(HEADER_REGEX);

	if (headerLineEnd === -1 || !nextHeaderMatch) {
		return joinContent(content, `${linesToAdd}\n`);
	}

	const nextHeaderIndex = restOfContent.indexOf(nextHeaderMatch[0]);
	const insertPos = headerLineEnd + 1 + nextHeaderIndex;
	const before = content.slice(0, insertPos);
	const after = content.slice(insertPos);

	return joinContent(before, linesToAdd) + '\n\n' + after;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function joinContent(content: string, newContent: string) {
	const trimmedContent = content.trimEnd();
	if (!trimmedContent) return `${newContent}`;

	const lastLine = trimmedContent.split('\n').at(-1) ?? '';
	const isMdHeader = HEADER_REGEX.test(lastLine);
	const separator = isMdHeader ? '\n\n' : '\n';

	return `${trimmedContent}${separator}${newContent}`;
}
