import { describe, expect, test } from 'vitest';
import { resolveEnvMode } from '../env.ts';

describe('resolveEnvMode', () => {
	test('no kit -> legacy', () => {
		expect(resolveEnvMode({ kitRange: undefined, explicitEnvFlag: false })).toBe('legacy');
	});
	test('kit 2 default -> legacy', () => {
		expect(resolveEnvMode({ kitRange: '^2.0.0', explicitEnvFlag: false })).toBe('legacy');
	});
	test('kit 2 + explicit flag -> declared', () => {
		expect(resolveEnvMode({ kitRange: '^2.0.0', explicitEnvFlag: true })).toBe('declared');
	});
	test('kit 3 range -> declared', () => {
		expect(resolveEnvMode({ kitRange: '^3.0.0-next.1', explicitEnvFlag: false })).toBe('declared');
	});
	test('next dist-tag -> declared', () => {
		expect(resolveEnvMode({ kitRange: 'next', explicitEnvFlag: false })).toBe('declared');
	});
});
