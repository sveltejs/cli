import { expect, test } from 'vitest';
import dedent from 'dedent';
import { guessIndentString } from '../utils.ts';

test('works', () => {
	const code = dedent`
    foreach(const foo of bar) {
    	console.log(foo)
    }
    `;

	expect(guessIndentString(code)).toMatchInlineSnapshot('"	"');
});
