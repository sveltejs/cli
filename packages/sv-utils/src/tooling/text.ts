type CommentEntry = { text: string; mode: 'append' | 'prepend' };
type CommentOption = string | Array<string | CommentEntry>;

/**
 * Add a line to flat file content (.env, .gitignore, etc.) if missing, never overwrites.
 * - key + value → "KEY=value" (skips if KEY= already present)
 * - key only → "key" line (skips if already present, e.g. gitignore entry)
 * - comment → string, string[], or { text, mode }[] for prepend/append comments
 * - separator → adds a blank line before this entry (for visual grouping)
 */
export function add(
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

/** @deprecated Use `add` (same behavior) or `set`. */
export const upsert: typeof add = add;

/** Like `add`, but replaces the value of an existing `KEY=` line. */
export function set(
	content: string,
	key: string,
	options?: { value?: string; comment?: CommentOption; separator?: boolean }
): string {
	key = key.trim();
	const value = options?.value;
	const lines = content.split('\n');
	const index =
		value === undefined ? -1 : lines.findIndex((line) => line.split('=')[0].trim() === key);
	if (index === -1) return add(content, key, options);
	lines[index] = `${key}=${value}`;
	return lines.join('\n');
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
