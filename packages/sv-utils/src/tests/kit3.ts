import { describe, expect, it } from 'vitest';
import { resolveHooksTypesFrom } from '../kit3.ts';

describe('resolveHooksTypesFrom', () => {
	it.each(['^2.70.3', '2', 'workspace:^2.5.0'])('%s -> @sveltejs/kit', (range) => {
		expect(resolveHooksTypesFrom(range)).toBe('@sveltejs/kit');
	});

	it.each(['^3.0.0', '3.0.0-next.5', 'next', 'latest', '*', 'catalog:', 'workspace:*', undefined])(
		'%s -> @sveltejs/kit/hooks',
		(range) => {
			expect(resolveHooksTypesFrom(range)).toBe('@sveltejs/kit/hooks');
		}
	);
});
