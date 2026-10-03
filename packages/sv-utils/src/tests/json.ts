import { describe, expect, it } from 'vitest';
import { parseJson, serializeJson } from '../tooling/index.ts';
import { arrayUpsert, packageScriptsUpsert } from '../tooling/json.ts';

describe('JSON comments', () => {
	it('preserves comments and blank lines when editing JSONC', () => {
		const source = `{
	"compilerOptions": {
		"lib": ["ES2023", "DOM"], // sync with app.html browser check
		"types": ["node"],

		// Stricter Typechecking Options
		"noUncheckedIndexedAccess": true
	}
}`;
		const data = parseJson(source);
		data.compilerOptions.types.push('$app/types');

		expect(serializeJson(source, data)).toBe(`{
	"compilerOptions": {
		"lib": ["ES2023", "DOM"], // sync with app.html browser check
		"types": ["node", "$app/types"],

		// Stricter Typechecking Options
		"noUncheckedIndexedAccess": true
	}
}`);
	});

	it('preserves comments when object properties are reordered', () => {
		const source = `{
	// first
	"first": 1,
	// second
	"second": 2
}`;
		const data = parseJson(source);
		const first = data.first;
		delete data.first;
		data.first = first;

		expect(serializeJson(source, data)).toBe(`{
	// second
	"second": 2,
	// first
	"first": 1
}`);
	});
	it('keeps untouched text byte-identical', () => {
		const source = '{\r\n    "a" :  1,  /* note */\r\n    "b": [ 1,2 ],\r\n}\r\n';
		expect(serializeJson(source, parseJson(source))).toBe(source);
	});

	it('removes entries with their comments and keeps trailing commas', () => {
		const source = `{
	// old
	"old": true,
	"plugins": ["a", "b",],
}
`;
		const data = parseJson(source);
		delete data.old;
		data.plugins.push('c');

		expect(serializeJson(source, data)).toBe(`{
	"plugins": ["a", "b", "c"],
}
`);
	});

	it('expands an inline array once it no longer fits on one line', () => {
		const source = `{
	"recommendations": ["svelte.svelte-vscode"]
}`;
		const data = parseJson(source);
		data.recommendations.push('esbenp.prettier-vscode', 'dbaeumer.vscode-eslint');

		expect(serializeJson(source, data)).toBe(`{
	"recommendations": [
		"svelte.svelte-vscode",
		"esbenp.prettier-vscode",
		"dbaeumer.vscode-eslint"
	]
}`);
	});
});

describe('arrayUpsert', () => {
	it('append', () => {
		const data = { a: ['b'] };
		arrayUpsert(data, 'a', 'c');
		expect(data).toEqual({ a: ['b', 'c'] });
	});

	it('prepend', () => {
		const data = { a: ['b'] };
		arrayUpsert(data, 'a', 'c', { mode: 'prepend' });
		expect(data).toEqual({ a: ['c', 'b'] });
	});

	it('create', () => {
		const data = { a: ['b'] };
		arrayUpsert(data, 'z', 'c');
		expect(data).toEqual({ a: ['b'], z: ['c'] });
	});

	it('no change', () => {
		const data = { a: ['b', 'c'] };
		arrayUpsert(data, 'a', 'b');
		expect(data).toEqual({ a: ['b', 'c'] });
	});
});

describe('objectUpsert', () => {
	it('create', () => {
		const data = {};
		packageScriptsUpsert(data, 'lint', 'cmd');
		expect(data).toEqual({ scripts: { lint: 'cmd' } });
	});

	it('add', () => {
		const data = { scripts: { lint: 'b' } };
		packageScriptsUpsert(data, 'lint', 'cmd');
		expect(data).toEqual({ scripts: { lint: 'b && cmd' } });
	});

	it('add many', () => {
		const data = { scripts: { lint: 'eslint .' } };
		packageScriptsUpsert(data, 'lint', 'prettier .');
		packageScriptsUpsert(data, 'lint', 'eslint .'); // should not add duplicate
		expect(data).toEqual({ scripts: { lint: 'eslint . && prettier .' } });
	});

	it('prepend', () => {
		const data = { scripts: { lint: 'eslint .' } };
		packageScriptsUpsert(data, 'lint', 'prettier .', { mode: 'prepend' });
		expect(data).toEqual({ scripts: { lint: 'prettier . && eslint .' } });
	});
});
