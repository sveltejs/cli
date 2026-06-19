import { diffLines } from 'diff';

/**
 * @param name - The name to sanitize.
 * @param style - The sanitization style.
 *   - `package` for package.json
 *   - `wrangler` for Cloudflare Wrangler compatibility
 * @returns The sanitized name.
 */
export function sanitizeName(name: string, style: 'package' | 'wrangler'): string {
	let sanitized = name.trim().toLowerCase().replace(/\s+/g, '-');
	if (style === 'package') {
		const hasLeadingAt = sanitized.startsWith('@');
		sanitized = sanitized
			.replace(/\s+/g, '-')
			.replace(/^[._]/, '')
			.replace(/[^a-z0-9~./-]+/g, '-');
		if (hasLeadingAt) sanitized = '@' + sanitized.slice(1);
	} else if (style === 'wrangler') {
		sanitized = sanitized
			.replace(/[^a-z0-9-]/g, '-')
			.replace(/-+/g, '-')
			.slice(0, 63)
			.replace(/^-|-$/g, '');
	} else {
		throw new Error(`Invalid kind: ${style}`);
	}
	return sanitized || 'undefined-sv-name';
}

/**
 * Preserves blank lines from the original content and drops blank lines newly introduced by the
 * updated content, while keeping non-whitespace changes from the updated content.
 * This helps reduce formatting-only diffs from tools like `esrap` without restoring deleted code.
 */
export function preserveOriginalNewlines(old: string, updated: string): string {
	const diff = diffLines(old, updated);
	let newContent = '';
	const isOnlyWhitespace = (value: string) => {
		return value.trim() === '';
	};

	for (const part of diff) {
		if (part.added && isOnlyWhitespace(part.value)) {
			continue;
		}

		if (part.removed && !isOnlyWhitespace(part.value)) {
			continue;
		}

		newContent += part.value;
	}

	return newContent;
}
