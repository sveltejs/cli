import { describe, expect, it } from 'vitest';
import { arrayUpsert } from '../tooling/json.ts';

describe('json', () => {
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
