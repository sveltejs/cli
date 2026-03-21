import { describe, expect, it } from 'vitest';
import { isTransform, transforms } from '../tooling/transforms.ts';

describe('transforms', () => {
	describe('json', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = '{"name":"old"}';
			const fn = transforms.json((data) => {
				data.name = 'new';
			});
			const result = fn(input);
			expect(JSON.parse(result)).toEqual({ name: 'new' });
		});

		it('abort: returns original content on false', () => {
			const input = '{"name":"old"}';
			const fn = transforms.json(() => false);
			expect(fn(input)).toBe(input);
		});

		it('onParseError: calls handler and returns original content', () => {
			const input = 'not: json';
			let caught = false;
			const fn = transforms.json(() => {}, {
				onParseError: () => {
					caught = true;
				}
			});
			expect(fn(input)).toBe(input);
			expect(caught).toBe(true);
		});

		it('throws on parse error without onParseError', () => {
			const fn = transforms.json(() => {});
			expect(() => fn('not: json')).toThrow();
		});
	});

	describe('text', () => {
		it('transforms content', () => {
			const fn = transforms.text((content) => content + '\nappended');
			expect(fn('line1')).toBe('line1\nappended');
		});

		it('abort: returns original content on false', () => {
			const input = 'original';
			const fn = transforms.text(() => false);
			expect(fn(input)).toBe(input);
		});
	});

	describe('isTransform', () => {
		it('returns true for branded transform', () => {
			expect(isTransform(transforms.json(() => {}))).toBe(true);
		});

		it('returns false for plain function', () => {
			expect(isTransform((content: string) => content)).toBe(false);
		});
	});
});
