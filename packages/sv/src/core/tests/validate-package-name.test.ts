import { describe, it, expect } from 'vitest';
import { validatePackageName } from '../validate-package-name.js';

// https://github.com/npm/validate-npm-package-name/blob/f63469d58278635630681c2506f05176ff18a7cb/test/index.js
describe('validatePackageName', () => {
	describe('traditional valid names', () => {
		it('validate-npm-package-name', () => {
			expect(validatePackageName('validate-npm-package-name')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('some-package', () => {
			expect(validatePackageName('some-package')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('example.com', () => {
			expect(validatePackageName('example.com')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('under_score', () => {
			expect(validatePackageName('under_score')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('period.js', () => {
			expect(validatePackageName('period.js')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('123numeric', () => {
			expect(validatePackageName('123numeric')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});
	});

	describe('traditional legacy names (validForOldPackages only)', () => {
		it('crazy!', () => {
			expect(validatePackageName('crazy!')).toEqual({
				validForNewPackages: false,
				validForOldPackages: true,
				warnings: ['name can no longer contain special characters ("~\'!()*")']
			});
		});
	});

	describe('scoped valid names (npm 2+)', () => {
		it('@npm/thingy', () => {
			expect(validatePackageName('@npm/thingy')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('@user/node_modules', () => {
			expect(validatePackageName('@user/node_modules')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('@user/-package', () => {
			expect(validatePackageName('@user/-package')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('@user/_package', () => {
			expect(validatePackageName('@user/_package')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});

		it('@user/http', () => {
			expect(validatePackageName('@user/http')).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});
	});

	describe('scoped legacy names', () => {
		it('@npm-zors/money!time.js', () => {
			expect(validatePackageName('@npm-zors/money!time.js')).toEqual({
				validForNewPackages: false,
				validForOldPackages: true,
				warnings: ['name can no longer contain special characters ("~\'!()*")']
			});
		});
	});

	describe('invalid names (errors only)', () => {
		it('null', () => {
			expect(validatePackageName(null)).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot be null']
			});
		});

		it('undefined', () => {
			expect(validatePackageName(undefined)).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot be undefined']
			});
		});

		it('42 (number)', () => {
			expect(validatePackageName(42)).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name must be a string']
			});
		});

		it('empty string', () => {
			expect(validatePackageName('')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name length must be greater than zero']
			});
		});

		it('.start-with-period', () => {
			expect(validatePackageName('.start-with-period')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot start with a period']
			});
		});

		it('@npm/.', () => {
			expect(validatePackageName('@npm/.')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot start with a period']
			});
		});

		it('@npm/..', () => {
			expect(validatePackageName('@npm/..')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot start with a period']
			});
		});

		it('@npm/.package', () => {
			expect(validatePackageName('@npm/.package')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot start with a period']
			});
		});

		it('_start-with-underscore', () => {
			expect(validatePackageName('_start-with-underscore')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot start with an underscore']
			});
		});

		it('-start-with-hyphen', () => {
			expect(validatePackageName('-start-with-hyphen')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot start with a hyphen']
			});
		});

		it('--start-with-double-hyphen', () => {
			expect(validatePackageName('--start-with-double-hyphen')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name cannot start with a hyphen']
			});
		});

		it('contain:colons', () => {
			expect(validatePackageName('contain:colons')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name can only contain URL-friendly characters']
			});
		});

		it(' leading-space', () => {
			expect(validatePackageName(' leading-space')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: [
					'name cannot contain leading or trailing spaces',
					'name can only contain URL-friendly characters'
				]
			});
		});

		it('trailing-space ', () => {
			expect(validatePackageName('trailing-space ')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: [
					'name cannot contain leading or trailing spaces',
					'name can only contain URL-friendly characters'
				]
			});
		});

		it('s/l/a/s/h/e/s', () => {
			expect(validatePackageName('s/l/a/s/h/e/s')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['name can only contain URL-friendly characters']
			});
		});

		it('node_modules', () => {
			expect(validatePackageName('node_modules')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['node_modules is not a valid package name']
			});
		});

		it('favicon.ico', () => {
			expect(validatePackageName('favicon.ico')).toEqual({
				validForNewPackages: false,
				validForOldPackages: false,
				errors: ['favicon.ico is not a valid package name']
			});
		});
	});

	describe('node/io core legacy names', () => {
		it('http', () => {
			expect(validatePackageName('http')).toEqual({
				validForNewPackages: false,
				validForOldPackages: true,
				warnings: ['http is a core module name']
			});
		});

		it('process', () => {
			expect(validatePackageName('process')).toEqual({
				validForNewPackages: false,
				validForOldPackages: true,
				warnings: ['process is a core module name']
			});
		});
	});

	describe('long package names', () => {
		it('name > 214 chars (invalid for new)', () => {
			const longName =
				'ifyouwanttogetthesumoftwonumberswherethosetwonumbersarechosenbyfindingthelargestoftwooutofthreenumbersandsquaringthemwhichismultiplyingthembyitselfthenyoushouldinputthreenumbersintothisfunctionanditwilldothatforyou-';
			expect(validatePackageName(longName)).toEqual({
				validForNewPackages: false,
				validForOldPackages: true,
				warnings: ['name can no longer contain more than 214 characters']
			});
		});

		it('name === 214 chars (valid)', () => {
			const maxName =
				'ifyouwanttogetthesumoftwonumberswherethosetwonumbersarechosenbyfindingthelargestoftwooutofthreenumbersandsquaringthemwhichismultiplyingthembyitselfthenyoushouldinputthreenumbersintothisfunctionanditwilldothatforyou';
			expect(validatePackageName(maxName)).toEqual({
				validForNewPackages: true,
				validForOldPackages: true
			});
		});
	});

	describe('legacy mixed-case names', () => {
		it('CAPITAL-LETTERS', () => {
			expect(validatePackageName('CAPITAL-LETTERS')).toEqual({
				validForNewPackages: false,
				validForOldPackages: true,
				warnings: ['name can no longer contain capital letters']
			});
		});
	});
});
