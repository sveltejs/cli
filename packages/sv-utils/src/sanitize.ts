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
 * Minimizes formatting churn in generated output.
 *
 * Formatting-only hunks are restored verbatim from the original. Real changes keep the updated
 * content while reusing the original blank-line layout when the old and updated lines can be paired
 * safely. This avoids unrelated punctuation and blank-line churn around useful edits without
 * rewriting authored content.
 *
 * Brand-new or whitespace-only files are kept verbatim: their blank lines are authored layout, not
 * printer churn, so stripping them would mangle generated markdown, env files, etc.
 */
export function minimizeDiff(old: string, updated: string): string {
	if (isBlank(old)) return updated;

	const original = normalizeLineEndings(old);
	const replacement = normalizeLineEndings(updated);

	// These passes need different line alignment. First restore formatting-only replacements using
	// exact lines, then ignore indentation while restoring the original blank-line layout.
	const formattingMinimized = restoreFormattingOnlyChanges(original, replacement);
	return restoreBlankLineLayout(original, formattingMinimized);
}

type LineChange = ReturnType<typeof diffLines>[number];

function restoreFormattingOnlyChanges(original: string, replacement: string): string {
	// Exact matching keeps closing braces and other repeated punctuation attached to the replacement
	// that reformatted them instead of letting diffLines use them as misleading anchors.
	const changes = diffLines(original, replacement);
	let result = '';

	for (let i = 0; i < changes.length; i += 1) {
		const change = changes[i];
		const next = changes[i + 1];

		if (change.removed && next?.added) {
			result +=
				normalizeForComparison(change.value) === normalizeForComparison(next.value)
					? change.value
					: next.value;
			i += 1;
		} else if (!change.removed) {
			result += change.value;
		}
	}

	return result;
}

function restoreBlankLineLayout(original: string, replacement: string): string {
	// The formatting pass has already handled rewrapped hunks. Ignoring whitespace here gives
	// diffLines stable anchors across reindentation so isolated blank-line moves remain visible.
	const changes = diffLines(original, replacement, { ignoreWhitespace: true });
	let result = '';

	for (let i = 0; i < changes.length; ) {
		const change = changes[i];
		const next = changes[i + 1];
		const afterNext = changes[i + 2];

		if (isChange(change) && next && isOppositeChange(change, next)) {
			result += resolveReplacement([change, next]);
			i += 2;
			continue;
		}

		// diffLines can use a blank line as an anchor between the removed and added sides of a
		// replacement. Consider that anchor as part of the hunk so the decision is still made here.
		if (
			isChange(change) &&
			next &&
			!isChange(next) &&
			isBlank(next.value) &&
			afterNext &&
			isOppositeChange(change, afterNext)
		) {
			result += resolveReplacement([change, next, afterNext]);
			i += 3;
			continue;
		}

		if (!isChange(change)) {
			result += change.value;
		} else if (isBlank(change.value)) {
			// Keep removed blank lines and discard added ones.
			if (change.removed) result += change.value;
		} else if (change.added) {
			result += change.value;
		}

		i += 1;
	}

	return result;
}

function normalizeLineEndings(value: string): string {
	return value.replace(/\r\n?/g, '\n');
}

function isChange(change: LineChange): boolean {
	return change.added === true || change.removed === true;
}

function isOppositeChange(a: LineChange, b: LineChange): boolean {
	return (a.added === true && b.removed === true) || (a.removed === true && b.added === true);
}

function isBlank(value: string): boolean {
	return value.trim() === '';
}

function resolveReplacement(changes: LineChange[]): string {
	// Reconstruct both sides because a replacement may include an unchanged blank-line anchor.
	// Formatting-equivalent replacements use the original verbatim; real edits keep their updated
	// content while borrowing the original blank-line positions when the lines pair safely.
	let original = '';
	let replacement = '';

	for (const change of changes) {
		if (!change.added) original += change.value;
		if (!change.removed) replacement += change.value;
	}

	if (normalizeForComparison(original) === normalizeForComparison(replacement)) return original;

	return preserveBlankLineLayout(original, replacement);
}

function normalizeForComparison(value: string): string {
	return value
		.replace(/\s/g, '')
		.replace(/;/g, '')
		.replace(/,([}\]])/g, '$1')
		.replace(/,$/, '');
}

function preserveBlankLineLayout(original: string, replacement: string): string {
	const originalLines = original.split('\n');
	const replacementLines = replacement.split('\n');
	const replacementContent = replacementLines.filter((line) => line.trim() !== '');

	// Positional pairing is only safe when every original content line has an updated counterpart.
	if (originalLines.filter((line) => line.trim() !== '').length !== replacementContent.length) {
		return replacement;
	}

	let contentIndex = 0;
	return originalLines
		.map((line) => (line.trim() === '' ? line : replacementContent[contentIndex++]))
		.join('\n');
}
