import { describe, expect, it } from 'vitest';
import { parseAddonOptions } from '../utils/common.ts';

describe('parseAddonOptions', () => {
	it('returns undefined on undefined', () => {
		expect(parseAddonOptions(undefined)).toEqual(undefined);
	});
	it('returns undefined on empty string', () => {
		expect(parseAddonOptions('')).toEqual(undefined);
	});
	it('parses options and values', () => {
		expect(parseAddonOptions('option:value')).toEqual(['option:value']);
	});
	it('parses values with empty strings', () => {
		expect(parseAddonOptions('foo:')).toEqual(['foo:']);
		expect(parseAddonOptions('foo:+bar:+baz:')).toEqual(['foo:', 'bar:', 'baz:']);
	});
	it('parses sentences', () => {
		expect(parseAddonOptions('foo:the quick brown fox')).toEqual(['foo:the quick brown fox']);
	});
	it('parses lists', () => {
		expect(parseAddonOptions('foo:en,es,de')).toEqual(['foo:en,es,de']);
	});
	it('errors on missing value', () => {
		expect(() => parseAddonOptions('foo')).toThrowError(
			"Malformed arguments: Add-on's option 'foo' is missing it's option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
	it('errors on a partial missing values', () => {
		expect(() => parseAddonOptions('foo:value1+bar')).toThrowError(
			"Malformed arguments: Add-on's option 'bar' is missing it's option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
	it('errors on two missing values', () => {
		expect(() => parseAddonOptions('foo+bar')).toThrowError(
			"Malformed arguments: Add-on's option 'foo' & 'bar' is missing it's option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
});
