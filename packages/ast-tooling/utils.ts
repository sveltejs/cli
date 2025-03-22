import * as Walker from 'zimmerframe';
import type { TsEstree } from './ts-estree.ts';

// Sourced from `golden-fleece`
// https://github.com/Rich-Harris/golden-fleece/blob/f2446f331640f325e13609ed99b74b6a45e755c2/src/patch.ts#L302
export function guessIndentString(str: string | undefined): string {
	if (!str) return '\t';

	const lines = str.split('\n');

	let tabs = 0;
	let spaces = 0;
	let minSpaces = 8;

	lines.forEach((line) => {
		const match = /^(?: +|\t+)/.exec(line);
		if (!match) return;

		const whitespace = match[0];
		if (whitespace.length === line.length) return;

		if (whitespace[0] === '\t') {
			tabs += 1;
		} else {
			spaces += 1;
			if (whitespace.length > 1 && whitespace.length < minSpaces) {
				minSpaces = whitespace.length;
			}
		}
	});

	if (spaces > tabs) {
		let result = '';
		while (minSpaces--) result += ' ';
		return result;
	} else {
		return '\t';
	}
}

export function guessQuoteStyle(ast: TsEstree.Node): 'single' | 'double' | undefined {
	let singleCount = 0;
	let doubleCount = 0;

	Walker.walk(ast, null, {
		Literal(node) {
			if (node.raw && node.raw.length >= 2) {
				// we have at least two characters in the raw string that could represent both quotes
				const quotes = [node.raw[0], node.raw[node.raw.length - 1]];
				for (const quote of quotes) {
					switch (quote) {
						case "'":
							singleCount++;
							break;
						case '"':
							doubleCount++;
							break;
						default:
							break;
					}
				}
			}
		}
	});

	if (singleCount === 0 && doubleCount === 0) {
		// new file or file without any quotes
		return undefined;
	}

	return singleCount > doubleCount ? 'single' : 'double';
}
