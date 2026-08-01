import { describe, it, expect } from 'vitest';
import { validateProjectName } from '../validate-project-name.js';

describe('validateProjectName', () => {
	describe('valid names (return undefined)', () => {
		it('validate-npm-package-name', () => {
			expect(validateProjectName('validate-npm-package-name')).toBeUndefined();
		});

		it('some-package', () => {
			expect(validateProjectName('some-package')).toBeUndefined();
		});

		it('example.com', () => {
			expect(validateProjectName('example.com')).toBeUndefined();
		});

		it('under_score', () => {
			expect(validateProjectName('under_score')).toBeUndefined();
		});

		it('period.js', () => {
			expect(validateProjectName('period.js')).toBeUndefined();
		});

		it('123numeric', () => {
			expect(validateProjectName('123numeric')).toBeUndefined();
		});

		it('@npm/thingy', () => {
			expect(validateProjectName('@npm/thingy')).toBeUndefined();
		});

		it('@user/node_modules', () => {
			expect(validateProjectName('@user/node_modules')).toBeUndefined();
		});

		it('@user/-package', () => {
			expect(validateProjectName('@user/-package')).toBeUndefined();
		});

		it('@user/_package', () => {
			expect(validateProjectName('@user/_package')).toBeUndefined();
		});

		it('@user/http', () => {
			expect(validateProjectName('@user/http')).toBeUndefined();
		});

		it('max length (214 chars)', () => {
			const maxName =
				'ifyouwanttogetthesumoftwonumberswherethosetwonumbersarechosenbyfindingthelargestoftwooutofthreenumbersandsquaringthemwhichismultiplyingthembyitselfthenyoushouldinputthreenumbersintothisfunctionanditwilldothatforyou';
			expect(validateProjectName(maxName)).toBeUndefined();
		});
	});

	describe('invalid names (return error string)', () => {
		it('null', () => {
			expect(validateProjectName(null)).toBe('Package name cannot be null');
		});

		it('undefined', () => {
			expect(validateProjectName(undefined)).toBe('Package name cannot be undefined');
		});

		it('42 (number)', () => {
			expect(validateProjectName(42)).toBe('Package name must be a string');
		});

		it('empty string', () => {
			expect(validateProjectName('')).toBe('Package name is required.');
		});

		it('.start-with-period', () => {
			expect(validateProjectName('.start-with-period')).toBe(
				'Package name cannot start with a period'
			);
		});

		it('@npm/.', () => {
			expect(validateProjectName('@npm/.')).toBe('Package name cannot start with a period');
		});

		it('@npm/..', () => {
			expect(validateProjectName('@npm/..')).toBe('Package name cannot start with a period');
		});

		it('@npm/.package', () => {
			expect(validateProjectName('@npm/.package')).toBe('Package name cannot start with a period');
		});

		it('_start-with-underscore', () => {
			expect(validateProjectName('_start-with-underscore')).toBe(
				'Package name cannot start with an underscore'
			);
		});

		it('-start-with-hyphen', () => {
			expect(validateProjectName('-start-with-hyphen')).toBe(
				'Package name cannot start with a hyphen'
			);
		});

		it('contain:colons', () => {
			expect(validateProjectName('contain:colons')).toBe(
				'Package name can only contain URL-friendly characters: contain%3Acolons'
			);
		});

		it(' leading-space', () => {
			expect(validateProjectName(' leading-space')).toBe(
				'Package name can only contain URL-friendly characters: %20leading-space'
			);
		});

		it('trailing-space ', () => {
			expect(validateProjectName('trailing-space ')).toBe(
				'Package name can only contain URL-friendly characters: trailing-space%20'
			);
		});

		it('s/l/a/s/h/e/s', () => {
			expect(validateProjectName('s/l/a/s/h/e/s')).toBe(
				'Package name can only contain URL-friendly characters: s/l/a/s/h/e/s'
			);
		});

		it('node_modules', () => {
			expect(validateProjectName('node_modules')).toBe('node_modules is not a valid package name');
		});

		it('favicon.ico', () => {
			expect(validateProjectName('favicon.ico')).toBe('favicon.ico is not a valid package name');
		});

		it('http', () => {
			expect(validateProjectName('http')).toBe(
				'Package name can only contain URL-friendly characters: http'
			);
		});

		it('process', () => {
			expect(validateProjectName('process')).toBe(
				'Package name can only contain URL-friendly characters: process'
			);
		});

		it('> 214 chars', () => {
			const longName =
				'ifyouwanttogetthesumoftwonumberswherethosetwonumbersarechosenbyfindingthelargestoftwooutofthreenumbersandsquaringthemwhichismultiplyingthembyitselfthenyoushouldinputthreenumbersintothisfunctionanditwilldothatforyou-';
			expect(validateProjectName(longName)).toBe(
				'Package name cannot contain more than 214 characters'
			);
		});

		it('CAPITAL-LETTERS', () => {
			expect(validateProjectName('CAPITAL-LETTERS')).toBe(
				'Package name cannot contain capital letters'
			);
		});

		it('crazy!', () => {
			expect(validateProjectName('crazy!')).toBe(
				'Package name can only contain URL-friendly characters: crazy%21'
			);
		});

		it('@npm-zors/money!time.js', () => {
			expect(validateProjectName('@npm-zors/money!time.js')).toBe(
				'Package name can only contain URL-friendly characters: @npm-zors/money%21time.js'
			);
		});
	});
});
