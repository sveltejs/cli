export function upsert(
	content: string,
	header: `${'#' | '##' | '###' | '####' | '#####' | '######'} ${string}`,
	lines: Array<string | false | undefined | null | 0 | 0n>
): string {
	const [headerLevel, ...headerNameArray] = header.split(' ');
	const headerName = headerNameArray.join(' ');
	const linesToAdd = lines.filter(Boolean).join('\n');

	const sectionRegex = new RegExp(`^(${headerLevel})\\s+${escapeRegex(headerName)}\\s*$`, 'm');

	const match = content.match(sectionRegex);

	if (match) {
		const headerStart = match.index!;
		const headerLineEnd = content.indexOf('\n', headerStart);

		const restOfContent = content.slice(headerLineEnd + 1);
		const nextHeaderMatch = restOfContent.match(/^#{1,6}\s+.+$/m);

		if (nextHeaderMatch) {
			const nextHeaderIndex = restOfContent.indexOf(nextHeaderMatch[0]);

			const insertPos = headerLineEnd + 1 + nextHeaderIndex;
			const before = content.slice(0, insertPos);
			const after = content.slice(insertPos);

			return before + linesToAdd + '\n\n' + after;
		}

		const insertPos = content.length;
		const before = content.slice(0, insertPos);
		const after = content.slice(insertPos);

		return before + '\n' + linesToAdd + '\n' + after;
	}

	return content.trim() + `\n\n${headerLevel} ${headerName}\n\n${linesToAdd}\n`;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
