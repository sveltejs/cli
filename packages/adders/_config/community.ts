export type CommunityAdder = {
	name: string;
	description: string;
	category: string;
	npm: string;
	repo: string;
	website: string;
	logo: string;
};

/** EVALUATED AT BUILD TIME */
export const communityAdderIds: string[] = [];

export async function getCommunityAdders(name: string): Promise<CommunityAdder> {
	const { default: details } = await import(`../../../community/${name}.ts`);
	return details;
}
