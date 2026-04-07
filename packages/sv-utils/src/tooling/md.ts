type Header = `${'#' | '##' | '###' | '####' | '#####' | '######'} ${string}`;

const HEADER_REGEX = /^#{1,6} .+$/m;

function getHeaderLevel(header: Header): number {
	return header.split(' ')[0].length;
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

function findSection(
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
	const afterHeader = content.slice(headerEnd + 1);
	const nextHeaderMatch = afterHeader.match(nextHeaderRegex);

	let end: number;
	if (nextHeaderMatch) {
		end = headerEnd + 1 + afterHeader.indexOf(nextHeaderMatch[0]);
	} else {
		end = content.length;
	}

	const innerContent = content.slice(headerEnd + 1, end);
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

export function upsert(
	content: string,
	lines: Array<string | false | undefined | null | 0 | 0n>,
	options?: {
		header?:
			| Header
			| {
					name: Header;
					parent?: Header;
			  };
	}
): string {
	const { header } = options ?? {};
	const linesToAdd = lines.filter(Boolean).join('\n');

	if (!header) {
		return joinContent(content, linesToAdd);
	}

	if (typeof header === 'string') {
		return asdf(content, linesToAdd, header);
	} else {
		if (!header.parent) {
			return asdf(content, linesToAdd, header.name);
		}
		const section = findSection(content, header.parent);

		if (!section) {
			return joinContent(content, header.parent, header.name, linesToAdd);
		}

		return joinContent(
			section.before,
			section.header,
			section.innerContent,
			header.name,
			linesToAdd,
			section.after
		);
	}
}

function asdf(content: string, linesToAdd: string, header: Header): string {
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

export function addNextSteps(
	content: string,
	lines: Array<string | false | undefined | null | 0 | 0n>
): string {
	const linesToAdd = lines.filter(Boolean).join('\n');

	const svSection = findSection(content, '# sv');
	if (!svSection) return content;

	const firstChildMatch = svSection.innerContent.match(/^## Add-on Setup\s*$/m);
	if (!firstChildMatch) return content;

	return asdf(content, linesToAdd, '## Add-on Setup');
}
