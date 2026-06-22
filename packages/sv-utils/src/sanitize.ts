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

/** Splits content into lines, each keeping its trailing newline (matches the diff line tokenizer). */
function toLines(value: string): string[] {
	return value.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/**
 * Minimizes formatting churn in generated output.
 *
 * A line whose content is unchanged - ignoring whitespace, semicolons, commas and parentheses - is
 * restored verbatim from the original. This reverts everything a printer reformats but doesn't
 * meaningfully change: re-indentation, added semicolons, rewrapped punctuation and, crucially, the
 * blank lines printers like to insert between statements. Only lines with real content changes keep
 * the printer's output (printer-inserted blank lines among them are dropped).
 *
 * Brand-new files (no original to diff against) are kept verbatim: their blank lines are authored
 * layout, not printer churn, so stripping them would mangle generated markdown, env files, etc.
 */
// `diffLines` is O(N·D) in the number of differing lines, which explodes on large, heavily
// reformatted files (e.g. a minified bundle reprinted by a pretty-printer). Past this size we skip
// minimization and keep the printer's output verbatim rather than hanging.
const MAX_DIFF_INPUT_BYTES = 512 * 1024;

export function minimizeDiff(old: string, updated: string): string {
	if (isOnlyWhitespace(old)) return updated;
	if (old.length > MAX_DIFF_INPUT_BYTES || updated.length > MAX_DIFF_INPUT_BYTES) return updated;

	// Normalize line endings first: on Windows the original is often CRLF while the printer emits LF,
	// which would make every line differ and collapse the diff, defeating the restoration below.
	const diff = diffLines(old.replace(/\r\n/g, '\n'), updated.replace(/\r\n/g, '\n'));

	// blank lines are layout, not content: keep the original's, drop the ones printers insert
	const realContent = (value: string) =>
		toLines(value)
			.filter((l) => !isOnlyWhitespace(l))
			.join('');
	const blankLines = (value: string) => toLines(value).filter(isOnlyWhitespace).join('');

	let out = '';
	for (let i = 0; i < diff.length; i += 1) {
		const part = diff[i];
		const next = diff[i + 1];

		if (part.removed && next?.added) {
			// a changed range. If it differs only by formatting (whitespace, semicolons, rewrapping)
			// restore the original verbatim; otherwise keep the new content, minus inserted blanks but
			// keeping the original's blank lines.
			out +=
				normalizeWhitespace(part.value) === normalizeWhitespace(next.value)
					? part.value
					: blankLines(part.value) + realContent(next.value);
			i += 1;
		} else if (part.removed) {
			out += blankLines(part.value); // keep original blank lines, drop removed content
		} else if (part.added) {
			out += realContent(part.value); // real new content, minus printer-inserted blanks
		} else {
			out += part.value; // unchanged
		}
	}

	return out;
}
