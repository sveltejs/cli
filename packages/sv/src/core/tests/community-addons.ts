import process from 'node:process';
import * as p from '@clack/prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compatibleCommunityAddons, promptCommunityAddons } from '../community-addons.ts';

// ESM namespace exports can't be spied on
vi.mock('@clack/prompts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@clack/prompts')>();
	return { ...actual, autocompleteMultiselect: vi.fn(), isCancel: vi.fn(actual.isCancel) };
});

const autocomplete = vi.mocked(p.autocompleteMultiselect);
afterEach(() => {
	autocomplete.mockReset();
	vi.restoreAllMocks();
});

const list = [
	{ name: 'a', description: 'A', sv: '^1.2.0', downloads: 1200 },
	{ name: 'b', description: 'B', sv: '^0.9.0', downloads: 50 },
	{ name: 'c', description: 'C', sv: '*', downloads: 10 },
	{ name: 'd', description: 'D', sv: '>=1.0.0', downloads: 5 }
];

describe('compatibleCommunityAddons', () => {
	it('keeps entries matching the running sv major, in order', () => {
		expect(compatibleCommunityAddons(list, '1.7.0').map((a) => a.name)).toEqual(['a', 'd']);
	});

	it('hides unparseable sv ranges', () => {
		expect(compatibleCommunityAddons(list, '1.7.0').some((a) => a.name === 'c')).toBe(false);
	});

	it('returns empty when nothing matches', () => {
		expect(compatibleCommunityAddons(list, '2.0.0')).toEqual([]);
	});

	it('reads the baked list by default', () => {
		expect(Array.isArray(compatibleCommunityAddons())).toBe(true);
	});
});

describe('promptCommunityAddons', () => {
	it('prompts with download hints and returns add-on inputs', async () => {
		autocomplete.mockResolvedValue(['a']);
		expect(await promptCommunityAddons(list.slice(0, 1))).toEqual([
			{ specifier: 'a', options: [] }
		]);
		expect(autocomplete.mock.calls[0][0].options[0]).toMatchObject({
			value: 'a',
			label: 'a',
			hint: 'A · 1.2K/wk'
		});
	});

	it('exits on cancel', async () => {
		autocomplete.mockResolvedValue([]);
		vi.mocked(p.isCancel).mockReturnValueOnce(true);
		const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
		await promptCommunityAddons(list);
		expect(exit).toHaveBeenCalledWith(1);
	});
});
