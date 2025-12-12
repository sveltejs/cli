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
	it('parses values with colons', () => {
		expect(parseAddonOptions('option:foo:bar:baz')).toEqual(['option:foo:bar:baz']);
	});
	it('errors on missing value', () => {
		expect(() => parseAddonOptions('foo')).toThrowError(
			"Malformed arguments: The following add-on options: 'foo' are missing their option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
	it('errors when one of two options is missing a value', () => {
		expect(() => parseAddonOptions('foo:value1+bar')).toThrowError(
			"Malformed arguments: The following add-on options: 'bar' are missing their option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
	it('errors on two missing values', () => {
		expect(() => parseAddonOptions('foo+bar')).toThrowError(
			"Malformed arguments: The following add-on options: 'foo', 'bar' are missing their option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
});
