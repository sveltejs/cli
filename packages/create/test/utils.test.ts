import { expect, test, describe } from 'vitest';
import { usrNodeVer } from '../utils.ts';

describe('usrNodeVer', () => {
	test('returns object', () => {
		const got = usrNodeVer();
		const want = 'object';

		expect(typeof got).toStrictEqual(want);
	});

	test('returns a ver, major, minor, patch keys', () => {
		const got = usrNodeVer();
		const gotKeys = Object.keys(got);

		expect(gotKeys.includes('ver')).toBe(true);
		expect(gotKeys.includes('major')).toBe(true);
		expect(gotKeys.includes('minor')).toBe(true);
		expect(gotKeys.includes('patch')).toBe(true);
	});

	test('returns correct version', () => {
		const got = usrNodeVer();
		const want = process.version;

		expect(got.ver).toBe(want);
	});

	test('returns correct version points', () => {
		const got = usrNodeVer();
		const want = process.version.slice(1).split('.');
		expect(got.major).toBe(Number(want[0]));
		expect(got.minor).toBe(Number(want[1]));
		expect(got.patch).toBe(Number(want[2]));
	});
});
