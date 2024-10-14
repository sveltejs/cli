export type CommunityAdder = {
	name: string;
	description: string;
	npm: string;
	repo: string;
	homepage: string;
};

/** EVALUATED AT BUILD TIME */
export const communityAdderIds: string[] = [];

export async function getCommunityAdder(name: string): Promise<CommunityAdder> {
	const { default: details } = await import(`../../../community-adders/${name}.ts`);
	return details;
}
