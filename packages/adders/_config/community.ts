import type { Category, CommunityCategory } from './categories.ts';

export type CommunityAdder = {
	name: string;
	description: string;
	category: Category | CommunityCategory;
	npm: string;
	repo: string;
	website: string;
};

/** EVALUATED AT BUILD TIME */
export const communityAdderIds: string[] = [];

export async function getCommunityAdder(name: string): Promise<CommunityAdder> {
	const { default: details } = await import(`../_community/${name}.ts`);
	return details;
}
