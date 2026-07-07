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

function restoreBlankLineLayout(old: string, updated: string): string {
	const gaps = new Map<string, string | null>();
	let previous: string | undefined;
	let gap = '';

	for (const line of toLines(old)) {
		if (isOnlyWhitespace(line)) {
			gap += line;
			continue;
		}

		const current = normalizeWhitespace(line);
		if (previous !== undefined) {
			const key = `${previous}\0${current}`;
			const existing = gaps.get(key);
			if (existing === undefined || existing === gap) gaps.set(key, gap);
			else gaps.set(key, null);
		}
		previous = current;
		gap = '';
	}

	let out = '';
	previous = undefined;
	gap = '';
	for (const line of toLines(updated)) {
		if (isOnlyWhitespace(line)) {
			gap += line;
			continue;
		}

		const current = normalizeWhitespace(line);
		const original = previous === undefined ? undefined : gaps.get(`${previous}\0${current}`);
		out += (original ?? gap) + line;
		previous = current;
		gap = '';
	}

	return out + gap;
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
export function minimizeDiff(old: string, updated: string): string {
	if (isOnlyWhitespace(old)) return updated;

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
		const afterNext = diff[i + 2];

		if (
			part.added &&
			next &&
			!next.added &&
			!next.removed &&
			isOnlyWhitespace(next.value) &&
			afterNext?.removed &&
			normalizeWhitespace(part.value) === normalizeWhitespace(afterNext.value)
		) {
			out += next.value + afterNext.value;
			i += 2;
		} else if (
			part.removed &&
			next &&
			!next.added &&
			!next.removed &&
			isOnlyWhitespace(next.value) &&
			afterNext?.added &&
			normalizeWhitespace(part.value) === normalizeWhitespace(afterNext.value)
		) {
			// diffLines represents a blank line moving across otherwise unchanged content as the
			// content being removed, the blank line staying put, and the content being added again.
			out += part.value + next.value;
			i += 2;
		} else if (part.removed && next?.added) {
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

	return restoreBlankLineLayout(old.replace(/\r\n/g, '\n'), out);
}
