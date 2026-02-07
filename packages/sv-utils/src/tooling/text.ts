type CommentEntry = { text: string; mode: 'append' | 'prepend' };
type CommentOption = string | Array<string | CommentEntry>;

/**
 * Upsert a line into flat file content (.env, .gitignore, etc.)
 * - key + value → "KEY=value" (skips if KEY= already present)
 * - key only → "key" line (skips if already present, e.g. gitignore entry)
 * - comment → string, string[], or { text, mode }[] for prepend/append comments
 * - separator → adds a blank line before this entry (for visual grouping)
 */
export function upsert(
	content: string,
	key: string,
	options?: { value?: string; comment?: CommentOption; separator?: boolean }
): string {
	key = key.trim();
	const { value, comment, separator } = options ?? {};
	const dataLine = value !== undefined ? `${key}=${value}` : key;

	// key=value style: skip if KEY= already present (handles spaces around =)
	if (value !== undefined) {
		if (content.split('\n').some((line) => line.split('=')[0].trim() === key)) return content;
	} else {
		// key-only (gitignore style): skip if line already present
		if (content.includes(key)) return content;
	}

	// Normalize comment to CommentEntry[]
	const comments = normalizeComments(comment);
	const prependComments = comments.filter((c) => c.mode === 'prepend');
	const appendComments = comments.filter((c) => c.mode === 'append');

	let addition = '';
	if (separator && content.trim().length > 0) addition += '\n';
	for (const c of prependComments) addition += `# ${c.text}\n`;
	addition += dataLine;
	for (const c of appendComments) addition += `\n# ${c.text}`;

	return append(content, addition);
}

function normalizeComments(comment: CommentOption | undefined): CommentEntry[] {
	if (!comment) return [];
	if (typeof comment === 'string') return [{ text: comment, mode: 'prepend' }];
	if (Array.isArray(comment)) {
		return comment.map((c) => (typeof c === 'string' ? { text: c, mode: 'prepend' as const } : c));
	}
	return [];
}

function append(existing: string, line: string): string {
	const base = !existing.length || existing.endsWith('\n') ? existing : existing + '\n';
	return base + line + '\n';
}
