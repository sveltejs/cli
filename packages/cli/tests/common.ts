import { describe, expect, it } from 'vitest';
import { parseAddonOptions } from '../utils/common.ts';

describe('parseAddonOptions', () => {
	it('undefined', () => {
		expect(parseAddonOptions(undefined)).toEqual(undefined);
	});
	it('empty', () => {
		expect(parseAddonOptions('')).toEqual(undefined);
	});
	it('easy ok options', () => {
		expect(parseAddonOptions('bar:baz')).toEqual(['bar:baz']);
	});
	it('missing value', () => {
		expect(() => parseAddonOptions('foo')).toThrowError(
			"Malformed arguments: Add-on's option 'foo' is missing it's option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
	it('one ok, one missing value', () => {
		expect(() => parseAddonOptions('foo:bar+baz')).toThrowError(
			"Malformed arguments: Add-on's option 'baz' is missing it's option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
	it('two missing values', () => {
		expect(() => parseAddonOptions('foo+baz')).toThrowError(
			"Malformed arguments: Add-on's option 'foo' & 'baz' is missing it's option name or value (e.g. 'addon=option1:value1+option2:value2')."
		);
	});
});
