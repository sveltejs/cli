export type CommunityAdder = {
	id: string; // the npm package name
};

/** EVALUATED AT BUILD TIME */
export const communityAdderIds: string[] = [];

export async function getCommunityAdder(name: string): Promise<CommunityAdder> {
	const { default: details } = await import(`../../../community-adders/${name}.ts`);
	return details;
}
