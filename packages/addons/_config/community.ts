export type CommunityAddon = {
	id: string; // the npm package name
};

/** EVALUATED AT BUILD TIME */
export const communityAddonIds: string[] = [];

export async function getCommunityAddon(name: string): Promise<CommunityAddon> {
	const { default: details } = await import(`../../../community-addons/${name}.ts`);
	return details;
}
