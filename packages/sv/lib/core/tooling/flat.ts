/**
 * Upsert a line into flat file content (.env, .gitignore, etc.)
 * - key + value → "KEY=value" (skips if KEY= already present)
 * - key only → "key" line (skips if already present, e.g. gitignore entry)
 * - comment → "# comment" prepended before the line
 * - commentAfter → "# commentAfter" appended after the line
 */
export function upsert(
	content: string,
	key: string,
	options?: { value?: string; comment?: string; commentAfter?: string }
): string {
	key = key.trim();
	const { value, comment, commentAfter } = options ?? {};
	const commentLine = comment ? `# ${comment}` : '';
	const commentAfterLine = commentAfter ? `# ${commentAfter}` : '';
	const dataLine = value !== undefined ? `${key}=${value}` : key;

	// key=value style: skip if KEY= already present (handles spaces around =)
	if (value !== undefined) {
		if (content.split('\n').some((line) => line.split('=')[0].trim() === key)) return content;
	} else {
		// key-only (gitignore style): skip if line already present
		if (content.includes(key)) return content;
	}

	let addition = '';
	if (commentLine) addition += commentLine + '\n';
	addition += dataLine;
	if (commentAfterLine) addition += '\n' + commentAfterLine;

	return append(content, addition);
}

function append(existing: string, line: string): string {
	const base = !existing.length || existing.endsWith('\n') ? existing : existing + '\n';
	return base + line + '\n';
}
