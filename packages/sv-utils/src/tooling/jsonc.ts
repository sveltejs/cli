type Literal = { type: 'literal'; start: number; end: number; value: unknown };
type Property = { key: string; start: number; keyEnd: number; value: JsonNode };
type ObjectNode = { type: 'object'; start: number; end: number; properties: Property[] };
type ArrayNode = { type: 'array'; start: number; end: number; items: JsonNode[] };
type JsonNode = Literal | ObjectNode | ArrayNode;

/** One container entry: its leading trivia, the entry itself and its same-line trailing comment. */
type Chunk = { lead: string; body: string; tail: string };

const NUMBER_REGEX = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const STRING_REGEX = /"(?:[^"\\\n]|\\.)*"/y;
const STRINGS_REGEX = /"(?:[^"\\\n]|\\.)*"/g;
const LITERAL_REGEX = /true|false|null/y;
const INDENT_REGEX = /^[ \t]*/;
// prettier's default
const PRINT_WIDTH = 80;

export function parseJsonc(text: string): any {
	return toValue(parseTree(text).root);
}

/** Applies the minimal text edits turning `original` into `data`, keeping comments and formatting. */
export function patchJsonc(original: string, data: unknown, indent: string): string {
	const { root } = parseTree(original);
	const eol = original.includes('\r\n') ? '\r\n' : '\n';
	const patcher = new Patcher(original, indent, eol);
	return original.slice(0, root.start) + patcher.patch(root, data) + original.slice(root.end);
}

class Patcher {
	private text: string;
	private indent: string;
	private eol: string;

	constructor(text: string, indent: string, eol: string) {
		this.text = text;
		this.indent = indent;
		this.eol = eol;
	}

	patch(node: JsonNode, after: unknown): string {
		const raw = this.text.slice(node.start, node.end);
		if (deepEqual(toValue(node), after)) return raw;

		if (node.type === 'object' && isObject(after)) return this.patchObject(node, after);
		if (node.type === 'array' && Array.isArray(after)) return this.patchArray(node, after);
		return this.print(after, lineIndent(this.text, node.start));
	}

	private patchObject(node: ObjectNode, after: Record<string, unknown>): string {
		const chunks = this.chunks(
			node,
			node.properties.map((p) => ({ start: p.start, end: p.value.end }))
		);
		const existing = new Map(node.properties.map((p, i) => [p.key, { p, chunk: chunks.list[i]! }]));
		const first = node.properties[0];
		const separator = first ? this.text.slice(first.keyEnd, first.value.start) : ': ';

		const next: Chunk[] = [];
		for (const [key, value] of Object.entries(after)) {
			if (value === undefined) continue;
			const found = existing.get(key);
			if (found) {
				const { p, chunk } = found;
				const head = this.text.slice(p.start, p.value.start);
				const glued = chunk.body.slice(p.value.end - p.start);
				next.push({ ...chunk, body: head + this.patch(p.value, value) + glued });
			} else {
				const { lead, itemIndent } = this.newLead(node, chunks.list);
				next.push({
					lead,
					body: JSON.stringify(key) + separator + this.print(value, itemIndent),
					tail: ''
				});
			}
		}
		return this.render(node, next, chunks);
	}

	private patchArray(node: ArrayNode, after: unknown[]): string {
		const raw = this.text.slice(node.start, node.end);
		const isPrimitive = (v: unknown) => v === null || typeof v !== 'object';
		if (!raw.includes('\n') && !hasComment(raw) && after.every(isPrimitive)) {
			const printed = `[${after.map((v) => JSON.stringify(v)).join(', ')}]`;
			const lineStart = this.text.lastIndexOf('\n', node.start) + 1;
			let lineEnd = this.text.indexOf('\n', node.end);
			if (lineEnd === -1) lineEnd = this.text.length;
			const width = node.start - lineStart + printed.length + lineEnd - node.end;
			if (width <= PRINT_WIDTH) return printed;
			return this.print(after, lineIndent(this.text, node.start));
		}

		const chunks = this.chunks(node, node.items);
		const next: Chunk[] = [];
		if (after.length === node.items.length) {
			// same length: patch item by item so nested comments survive
			node.items.forEach((item, i) => {
				const chunk = chunks.list[i]!;
				const glued = chunk.body.slice(item.end - item.start);
				next.push({ ...chunk, body: this.patch(item, after[i]) + glued });
			});
			return this.render(node, next, chunks);
		}

		// keep items still present in order, drop the others, insert new ones
		const before = node.items.map(toValue);
		let i = 0;
		for (let j = 0; j < after.length; j++) {
			while (
				i < before.length &&
				!deepEqual(before[i], after[j]) &&
				!after.slice(j).some((v) => deepEqual(v, before[i]))
			)
				i++;
			if (i < before.length && deepEqual(before[i], after[j])) {
				next.push(chunks.list[i]!);
				i++;
			} else {
				const { lead, itemIndent } = this.newLead(node, chunks.list);
				next.push({ lead, body: this.print(after[j], itemIndent), tail: '' });
			}
		}
		return this.render(node, next, chunks);
	}

	/** Splits a container into chunks; trivia before the closing bracket stays in `closing`. */
	private chunks(node: ObjectNode | ArrayNode, entries: Array<{ start: number; end: number }>) {
		const list: Chunk[] = [];
		let pos = node.start + 1;
		let trailingComma = false;
		entries.forEach((entry, i) => {
			const lead = this.text.slice(pos, entry.start);
			const afterEntry = skipTrivia(this.text, entry.end);
			const hasComma = this.text[afterEntry] === ',';
			// comments between the entry and its comma stay glued to the entry
			const body = this.text.slice(entry.start, hasComma ? afterEntry : entry.end);
			const tailStart = hasComma ? afterEntry + 1 : entry.end;
			const tailEnd = sameLineTail(this.text, tailStart);
			list.push({ lead, body, tail: this.text.slice(tailStart, tailEnd) });
			pos = tailEnd;
			if (i === entries.length - 1) trailingComma = hasComma;
		});
		return { list, trailingComma, closing: this.text.slice(pos, node.end - 1) };
	}

	private newLead(node: ObjectNode | ArrayNode, existing: Chunk[]) {
		const last = existing.at(-1);
		if (last) {
			const nl = last.lead.lastIndexOf('\n');
			if (nl === -1) return { lead: ' ', itemIndent: lineIndent(this.text, node.start) };
			const itemIndent = last.lead.slice(nl + 1);
			return { lead: this.eol + itemIndent, itemIndent };
		}
		const itemIndent = lineIndent(this.text, node.start) + this.indent;
		return { lead: this.eol + itemIndent, itemIndent };
	}

	private render(
		node: ObjectNode | ArrayNode,
		next: Chunk[],
		{ trailingComma, closing }: { trailingComma: boolean; closing: string }
	): string {
		const [open, close] = node.type === 'object' ? ['{', '}'] : ['[', ']'];
		if (next.length === 0) return open + (hasComment(closing) ? closing : '') + close;

		const wasEmpty = (node.type === 'object' ? node.properties : node.items).length === 0;
		// an empty `{}` gets its closing bracket on its own line once filled
		if (wasEmpty && !closing.includes('\n')) closing = this.eol + lineIndent(this.text, node.start);

		const body = next
			.map((c, i) => c.lead + c.body + (i < next.length - 1 || trailingComma ? ',' : '') + c.tail)
			.join('');
		return open + body + closing + close;
	}

	private print(value: unknown, baseIndent: string): string {
		return JSON.stringify(value ?? null, null, this.indent)
			.split('\n')
			.join(this.eol + baseIndent);
	}
}

function lineIndent(text: string, offset: number): string {
	const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
	return INDENT_REGEX.exec(text.slice(lineStart, offset))![0];
}

function skipTrivia(text: string, pos: number): number {
	while (pos < text.length) {
		const ch = text[pos];
		if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') pos++;
		else if (text.startsWith('//', pos)) pos = lineCommentEnd(text, pos);
		else if (text.startsWith('/*', pos)) pos = blockCommentEnd(text, pos);
		else break;
	}
	return pos;
}

/** End of the comments following `pos` on the same line; bare whitespace is not consumed. */
function sameLineTail(text: string, pos: number): number {
	let end = pos;
	while (pos < text.length) {
		const ch = text[pos];
		if (ch === ' ' || ch === '\t') pos++;
		else if (text.startsWith('//', pos)) return lineCommentEnd(text, pos);
		else if (text.startsWith('/*', pos)) end = pos = blockCommentEnd(text, pos);
		else break;
	}
	return end;
}

function lineCommentEnd(text: string, pos: number): number {
	while (pos < text.length && text[pos] !== '\n' && text[pos] !== '\r') pos++;
	return pos;
}

function blockCommentEnd(text: string, pos: number): number {
	const close = text.indexOf('*/', pos + 2);
	if (close === -1) throw syntaxError(text, pos, 'Unterminated comment');
	return close + 2;
}

function hasComment(raw: string): boolean {
	const code = raw.replace(STRINGS_REGEX, '""');
	return code.includes('//') || code.includes('/*');
}

function parseTree(text: string): { root: JsonNode } {
	let pos = 0;

	const expect = (ch: string) => {
		pos = skipTrivia(text, pos);
		if (text[pos] !== ch) throw syntaxError(text, pos, `Expected '${ch}'`);
		pos++;
	};

	const parseString = (): string => {
		STRING_REGEX.lastIndex = pos;
		const match = STRING_REGEX.exec(text);
		if (!match) throw syntaxError(text, pos, 'Invalid string');
		pos += match[0].length;
		return JSON.parse(match[0]);
	};

	const parseValue = (): JsonNode => {
		pos = skipTrivia(text, pos);
		const start = pos;
		const ch = text[pos];

		if (ch === '{') {
			pos++;
			const properties: Property[] = [];
			while (true) {
				pos = skipTrivia(text, pos);
				if (text[pos] === '}') break;
				const propStart = pos;
				const key = parseString();
				const keyEnd = pos;
				expect(':');
				const value = parseValue();
				properties.push({ key, start: propStart, keyEnd, value });
				pos = skipTrivia(text, pos);
				if (text[pos] !== ',') break;
				pos++;
			}
			expect('}');
			return { type: 'object', start, end: pos, properties };
		}

		if (ch === '[') {
			pos++;
			const items: JsonNode[] = [];
			while (true) {
				pos = skipTrivia(text, pos);
				if (text[pos] === ']') break;
				items.push(parseValue());
				pos = skipTrivia(text, pos);
				if (text[pos] !== ',') break;
				pos++;
			}
			expect(']');
			return { type: 'array', start, end: pos, items };
		}

		if (ch === '"') {
			const value = parseString();
			return { type: 'literal', start, end: pos, value };
		}

		for (const regex of [NUMBER_REGEX, LITERAL_REGEX]) {
			regex.lastIndex = pos;
			const match = regex.exec(text);
			if (match) {
				pos += match[0].length;
				return { type: 'literal', start, end: pos, value: JSON.parse(match[0]) };
			}
		}
		throw syntaxError(text, pos, 'Unexpected token');
	};

	const root = parseValue();
	if (skipTrivia(text, pos) !== text.length) throw syntaxError(text, pos, 'Unexpected token');
	return { root };
}

function toValue(node: JsonNode): any {
	if (node.type === 'literal') return node.value;
	if (node.type === 'array') return node.items.map(toValue);
	const obj: Record<string, unknown> = {};
	for (const p of node.properties) obj[p.key] = toValue(p.value);
	return obj;
}

function syntaxError(text: string, pos: number, message: string): SyntaxError {
	const lines = text.slice(0, pos).split('\n');
	return new SyntaxError(`${message} at line ${lines.length}, column ${lines.at(-1)!.length + 1}`);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	v !== null && typeof v === 'object' && !Array.isArray(v);

/** Key order matters: a reordered object still needs rewriting. */
function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) && Array.isArray(b))
		return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
	if (isObject(a) && isObject(b)) {
		const ka = Object.keys(a).filter((k) => a[k] !== undefined);
		const kb = Object.keys(b).filter((k) => b[k] !== undefined);
		return ka.length === kb.length && ka.every((k, i) => k === kb[i] && deepEqual(a[k], b[k]));
	}
	return false;
}
