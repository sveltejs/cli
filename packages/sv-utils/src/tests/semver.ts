import { expect, describe, it } from 'vitest';
import {
	splitVersion,
	coerceVersion,
	isVersionUnsupportedBelow,
	minVersion
} from '../semver.ts';

describe('versionSplit', () => {
	const combinationsVersionSplit = [
		{ version: '18.13.0', expected: { major: 18, minor: 13, patch: 0 } },
		{ version: 'x.13.0', expected: { major: undefined, minor: 13, patch: 0 } },
		{ version: '18.y.0', expected: { major: 18, minor: undefined, patch: 0 } },
		{ version: '18.13.z', expected: { major: 18, minor: 13, patch: undefined } },
		{ version: '18', expected: { major: 18, minor: undefined, patch: undefined } },
		{ version: '18.13', expected: { major: 18, minor: 13, patch: undefined } },
		{ version: 'invalid', expected: { major: undefined, minor: undefined, patch: undefined } }
	];
	it.each(combinationsVersionSplit)(
		'should return the correct version for $version',
		({ version, expected }) => {
			expect(splitVersion(version)).toEqual(expected);
		}
	);
});

describe('coerceVersion', () => {
	const combinationsCoerceVersion = [
		{ version: '18.13.0', expected: { major: 18, minor: 13, patch: 0, version: '18.13.0' } },
		// semver.coerce regex-shifts: first numeric run becomes major
		{ version: 'x.13.0', expected: { major: 13, minor: 0, patch: 0, version: '13.0.0' } },
		// missing/non-numeric parts are filled with 0
		{ version: '18.y.0', expected: { major: 18, minor: 0, patch: 0, version: '18.0.0' } },
		{ version: '18.13.z', expected: { major: 18, minor: 13, patch: 0, version: '18.13.0' } },
		{ version: '18', expected: { major: 18, minor: 0, patch: 0, version: '18.0.0' } },
		{ version: '18.13', expected: { major: 18, minor: 13, patch: 0, version: '18.13.0' } },
		// ranges and `workspace:` prefix are understood
		{ version: '^9.0.0', expected: { major: 9, minor: 0, patch: 0, version: '9.0.0' } },
		{ version: '~1.2.3', expected: { major: 1, minor: 2, patch: 3, version: '1.2.3' } },
		{
			version: 'workspace:^5.4.3',
			expected: { major: 5, minor: 4, patch: 3, version: '5.4.3' }
		},
		// unparseable input
		{
			version: 'invalid',
			expected: { major: undefined, minor: undefined, patch: undefined, version: undefined }
		}
	];
	it.each(combinationsCoerceVersion)(
		'should return the correct version for $version',
		({ version, expected }) => {
			expect(coerceVersion(version)).toEqual(expected);
		}
	);
});

describe('minimumRequirement', () => {
	const combinationsMinimumRequirement = [
		{ version: '17', below: '18.3.0', expected: true },
		{ version: '18.2', below: '18.3.0', expected: true },
		{ version: '18.3.0', below: '18.3.1', expected: true },
		{ version: '18.3.1', below: '18.3.0', expected: false },
		{ version: '18.3.0', below: '18.3.0', expected: false },
		{ version: '18.3.0', below: '18.3', expected: false },
		{ version: '18.3.1', below: '18.3', expected: false },
		{ version: '18.3.1', below: '18', expected: false },
		{ version: '18', below: '18', expected: false },
		{ version: 'a', below: 'b', expected: undefined },
		{ version: '18.3', below: '18.3', expected: false },
		{ version: '18.4', below: '18.3', expected: false },
		{ version: '18.2', below: '18.3', expected: true },

		// if it's undefined, we can't say anything...
		{ version: undefined!, below: '18.3', expected: undefined },
		{ version: '', below: '18.3', expected: undefined }
	] as const;
	it.each(combinationsMinimumRequirement)(
		'($version below $below) should be $expected',
		({ version, below, expected }) => {
			expect(isVersionUnsupportedBelow(version, below)).toEqual(expected);
		}
	);
});

describe('minVersion', () => {
	it('returns the lowest version that satisfies the range', () => {
		expect(minVersion('^9.0.0')).toBe('9.0.0');
		expect(minVersion('~1.2.3')).toBe('1.2.3');
		expect(minVersion('workspace:^5.4.3')).toBe('5.4.3');
		expect(minVersion('2.x')).toBe('2.0.0');
		expect(minVersion('>=1.0.0 || >=2.3.1 <2.4.5')).toBe('1.0.0');
	});

	it('throws on unparseable ranges', () => {
		expect(() => minVersion('latest')).toThrow();
		expect(() => minVersion('workspace:*')).toThrow();
	});
});
