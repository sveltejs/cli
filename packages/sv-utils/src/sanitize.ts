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

function normalizeWhitespace(value: string): string {
	// Ignore formatting-only characters that commonly differ between source code and generated
	// output: whitespace, semicolons, commas, and parentheses.
	return value.replace(/[\s;,()]+/g, '');
}

function isOnlyWhitespace(value: string): boolean {
	return value.trim() === '';
}

/**
 * Minimizes formatting churn in generated output.
 * If a changed hunk only differs by formatting-only characters, the original hunk is restored.
 * Hunks with real content changes keep the updated content.
 */
export function minimizeDiff(old: string, updated: string): string {
	const diff = diffLines(old, updated);
	let newContent = '';

	for (let i = 0; i < diff.length; i += 1) {
		const part = diff[i];
		const next = diff[i + 1];

		// A changed line range is represented as a removed hunk followed by an added hunk.
		if (part.removed && next?.added) {
			const normalizedPart = normalizeWhitespace(part.value);
			const normalizedNextPart = normalizeWhitespace(next.value);
			const sameContent = normalizedPart === normalizedNextPart;
			newContent += sameContent ? part.value : next.value;
			i += 1;
			continue;
		}

		// Drop formatting-only additions, such as blank lines introduced by a printer.
		if (part.added && isOnlyWhitespace(part.value)) {
			continue;
		}

		// Keep unchanged content and removed whitespace. Drop removed non-whitespace content.
		if (!part.removed || isOnlyWhitespace(part.value)) {
			newContent += part.value;
		}
	}

	return newContent;
}
