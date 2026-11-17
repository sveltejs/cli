type CommentEntry = { text: string; mode: 'append' | 'prepend' };
type CommentOption = string | Array<string | CommentEntry>;

/**
 * Add a line to flat file content if missing.
 *
 * @example
 * ```ts
 * add('', 'node_modules'); // 'node_modules\n'
 * add('', 'PORT', { value: '5173' }); // 'PORT=5173\n'
 * add('PORT=5173\n', 'PORT', { value: '3000' }); // 'PORT=5173\n' (skipped, use `set` to overwrite)
 * add('', 'PORT', { value: '5173', comment: 'dev server port' }); // '# dev server port\nPORT=5173\n'
 * add('', 'PORT', { value: '5173', comment: [{ text: 'dev server port', mode: 'append' }] }); // 'PORT=5173\n# dev server port\n'
 * add('A=1\n', 'B', { value: '2', separator: true }); // 'A=1\n\nB=2\n' (blank line before the entry)
 * ```
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

/** @deprecated Use {@link add} (same behavior) or {@link set}. */
export const upsert: typeof add = add;

/** Like `add`, but replaces the value of an existing `KEY=` line.
 *
 * @example
 * ```ts
 * set('', 'PORT', { value: '5173' }); // 'PORT=5173\n'
 * set('PORT=3000\n', 'PORT', { value: '5173' }); // 'PORT=5173\n'
 * set('PORT=3000\n', 'NODE_ENV', { value: 'development' }); // 'PORT=3000\nNODE_ENV=development\n'
 * ```
 */
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
